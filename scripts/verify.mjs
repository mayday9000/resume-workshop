// Checks the rendered PDF against the rules in CLAUDE.md.
// Warnings do not fail the build; errors do. --strict promotes [[confirm]] markers to errors.
//
// Accepts the flag either way round, because `npm run verify --strict` hands the flag to npm
// (as npm_config_strict) rather than to the script, while `npm run verify -- --strict` passes it through.

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import matter from 'gray-matter';
import { root, resolveTarget, variantFromArgv } from './target.mjs';
import {
  KNOWN_HEADINGS, DILUTED_PHRASES, startsWithPowerVerb, entryEndDate,
  ALL_VERBS, PRESENT_FORMS, EXTRA_VERBS, SALES_VERBS, TECH_VERBS,
} from './uncc-standards.mjs';

const REQUIRED_HEADINGS = ['Education', 'Experience'];

async function extractPdf(file) {
  // pdfjs legacy build runs in plain Node; text extraction needs no canvas.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(file));
  const task = pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false });
  const doc = await task.promise;
  let text = '';
  let bottomY = Infinity;   // lowest baseline of real text on the last page
  let pageHeight = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
    if (i === doc.numPages) {
      pageHeight = page.getViewport({ scale: 1 }).height;
      for (const it of content.items) {
        if (it.str.trim()) bottomY = Math.min(bottomY, it.transform[5]);
      }
    }
  }
  const pages = doc.numPages;
  await task.destroy();
  return { pages, text, bottomY, pageHeight };
}

async function checkLink(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    }
    clearTimeout(timer);
    return { url, ok: res.status < 400, status: res.status };
  } catch (err) {
    return { url, ok: false, status: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}

export async function verify({ strict = false, checkLinks = true, variant = null } = {}) {
  const errors = [];
  const warnings = [];
  const notes = [];

  const target = resolveTarget(variant);
  const source = await readFile(target.source, 'utf8');
  const { data, content } = matter(source);

  let pdf;
  try {
    pdf = await extractPdf(target.pdf);
  } catch (err) {
    errors.push(`cannot read ${path.relative(root, target.pdf)} — run \`npm run render\` first (${err.message})`);
    return { errors, warnings, notes };
  }

  const flat = pdf.text.replace(/\s+/g, ' ').trim();
  const flatLower = flat.toLowerCase();
  notes.push(`extracted ${flat.length} characters from ${pdf.pages} page(s)`);

  // 1. One page, and it should actually fill that page.
  if (pdf.pages !== 1) errors.push(`page count is ${pdf.pages}, must be exactly 1`);

  const MARGIN_PT = 36; // 0.5in, matches @page in templates/resume.css
  if (Number.isFinite(pdf.bottomY) && pdf.pageHeight) {
    const gapIn = (pdf.bottomY - MARGIN_PT) / 72;
    notes.push(`bottom whitespace ${gapIn.toFixed(2)}in`);
    if (pdf.pages === 1 && gapIn > 1) {
      warnings.push(`${gapIn.toFixed(2)}in of blank space at the bottom - add content or loosen spacing so the page fills`);
    }
  }

  // 2. Text extracts cleanly (a PDF of images would come back near-empty).
  if (flat.length < 200) errors.push(`only ${flat.length} characters extracted — text may not be selectable`);

  // 3. Name and email present in the extracted text.
  if (data.name && !flat.includes(data.name)) errors.push(`name "${data.name}" not found in extracted PDF text`);
  const email = String(data.email ?? '');
  if (!email) {
    errors.push('frontmatter has no email');
  } else if (!email.includes('[[confirm') && !flat.includes(email)) {
    errors.push(`email "${email}" not found in extracted PDF text`);
  }

  // 4. Standard section headings present and recognised. Match on the keyword, not the whole
  //    string: a compound heading like "Education and Certifications" is still ATS-safe.
  const headings = [...content.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
  const lowerHeadings = headings.map((h) => h.toLowerCase());
  for (const required of REQUIRED_HEADINGS) {
    const word = required.toLowerCase();
    if (!lowerHeadings.some((h) => h.includes(word))) {
      errors.push(`missing required section heading "${required}"`);
    } else if (!flatLower.includes(word)) {
      errors.push(`heading "${required}" did not survive PDF text extraction`);
    }
  }
  for (const h of headings) {
    if (!KNOWN_HEADINGS.some((k) => h.toLowerCase().includes(k.toLowerCase()))) {
      warnings.push(`non-standard section heading "${h}" — ATS parsers prefer ${KNOWN_HEADINGS.join(', ')}`);
    }
  }

  // 5. ATS structure: no tables, no multi-column, no images.
  if (/^\s*\|.*\|\s*$/m.test(content)) errors.push('markdown table found — tables do not survive ATS parsing');
  if (/<table|column-count|display:\s*flex|display:\s*grid/i.test(content)) errors.push('multi-column or table markup found in resume.md');
  if (/!\[[^\]]*\]\(/.test(content)) errors.push('image found — resumes must be text only');

  // 6. [[confirm]] markers.
  const markers = [...content.matchAll(/\[\[confirm:([^\]]*)\]\]/g)].map((m) => m[1].trim());
  const fmMarkers = JSON.stringify(data).match(/\[\[confirm:[^\]]*\]\]/g) ?? [];
  const total = markers.length + fmMarkers.length;
  if (total > 0) {
    const msg = `${total} unresolved [[confirm]] marker(s)`;
    if (strict) errors.push(`${msg} — resolve every one before exporting`);
    else warnings.push(msg);
    for (const m of markers.slice(0, 12)) notes.push(`  confirm: ${m}`);
  }

  // 7. No em dashes or en dashes. Plain hyphens only.
  const fancy = (content.match(/[\u2014\u2013]/g) ?? []).length
    + (JSON.stringify(data).match(/[\u2014\u2013]/g) ?? []).length;
  if (fancy) {
    errors.push(`${fancy} em/en dash character(s) found - CLAUDE.md allows plain hyphens only`);
  }

  // 8. Consistency: end punctuation across bullets, and first-person pronouns.
  // Join wrapped continuation lines first: a bullet that spans two source lines is still one
  // bullet, and checking only its first line reports false punctuation mismatches.
  const bullets = [];
  let open = null;
  for (const line of content.split('\n')) {
    const start = line.match(/^\s*[-*]\s+(.*)$/);
    if (start) {
      if (open !== null) bullets.push(open);
      open = start[1].trim();
    } else if (open !== null && /^\s+\S/.test(line)) {
      open += ' ' + line.trim();
    } else if (open !== null) {
      bullets.push(open);
      open = null;
    }
  }
  if (open !== null) bullets.push(open);
  const checkable = bullets.filter((b) => b && !b.startsWith('`[[confirm'));
  if (checkable.length) {
    const withPeriod = checkable.filter((b) => /[.!?]$|\]\]`?$/.test(b)).length;
    if (withPeriod !== 0 && withPeriod !== checkable.length) {
      warnings.push(`inconsistent bullet punctuation — ${withPeriod} of ${checkable.length} bullets end with a period`);
    }
  }
  const firstPerson = content.match(/\b(I|my|me|we|our)\b/g);
  if (firstPerson) warnings.push(`first-person pronoun(s) found: ${[...new Set(firstPerson)].join(', ')}`);

  // 8. Date format consistency (Mon YYYY vs numeric).
  const numericDates = content.match(/\b\d{1,2}\/\d{4}\b/g);
  if (numericDates) warnings.push(`numeric dates found (${[...new Set(numericDates)].join(', ')}) — prefer "Mon YYYY"`);

  // 9. UNC Charlotte Career Center standards (Career Guide 2024 + Hire-A-Niner checklist).

  for (const phrase of DILUTED_PHRASES) {
    if (new RegExp(String.raw`\b${phrase}\b`, 'i').test(content)) {
      warnings.push(`diluted phrase "${phrase}" - the guide says to cut these and lead with a result`);
    }
  }

  const weak = checkable.filter((b) => !startsWithPowerVerb(b));
  for (const b of weak.slice(0, 5)) {
    warnings.push(`bullet does not open with a power action verb: "${b.replace(/\*\*/g, '').slice(0, 60)}"`);
  }

  // Reverse chronological order within every section.
  let current = null;
  const sections = new Map();
  for (const line of content.split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { current = h[1].trim(); sections.set(current, []); continue; }
    if (current && line.startsWith('**') && line.includes(' | ')) sections.get(current).push(line.trim());
  }
  const shortLabel = (e) => e.replace(/\*\*/g, '').split(' | ')[0].replace(/,.*$/, '').slice(0, 40);
  for (const [name, entries] of sections) {
    const dated = entries.map((e) => ({ e, d: entryEndDate(e) })).filter((x) => x.d !== null);
    for (let i = 1; i < dated.length; i++) {
      if (dated[i].d > dated[i - 1].d) {
        warnings.push(`${name}: "${shortLabel(dated[i].e)}" ends later than "${shortLabel(dated[i - 1].e)}" above it - sections must run reverse chronological`);
        break;
      }
    }
  }

  // Every experience entry needs a city and state (Career Guide, required elements per entry).
  for (const [name, entries] of sections) {
    if (!/experience/i.test(name)) continue;   // campus involvement entries do not carry one
    for (const e of entries) {
      const left = e.split(' | ')[0];
      if (!/,\s*[A-Z]{2}\b/.test(left) && !/remote/i.test(left)) {
        warnings.push(`${name}: "${shortLabel(e)}" has no city and state on its entry line`);
      }
    }
  }

  // Every date range names a month, never a bare year.
  const MONTH_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  for (const [name, entries] of sections) {
    for (const e of entries) {
      const range = e.split(' | ').pop().trim();
      const bare = range.split(/\s+-\s+/).some((part) => /\d{4}/.test(part) && !MONTH_RE.test(part));
      if (bare) warnings.push(`${name}: "${shortLabel(e)}" has a year with no month in "${range}"`);
    }
  }

  // Current roles take the bare verb form ("Own"), not third person ("Owns"). The UNC Charlotte
  // sample writes a Present role as "Process, verify, and maintain ...".
  let liveEntry = false;
  let liveLabel = '';
  for (const line of content.split('\n')) {
    if (line.startsWith('**') && line.includes(' | ')) {
      liveEntry = /present/i.test(line.split(' | ').pop());
      liveLabel = shortLabel(line.trim());
      continue;
    }
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (!bulletMatch || !liveEntry) continue;
    const word = bulletMatch[1].replace(/^\*\*/, '').replace(/[^A-Za-z].*$/, '');
    if (!/s$/.test(word) || /ss$/.test(word)) continue;
    const stem = word.slice(0, -1).toLowerCase();
    const known = ALL_VERBS.has(stem) || PRESENT_FORMS.has(stem) || EXTRA_VERBS.has(stem)
      || SALES_VERBS.has(stem) || TECH_VERBS.has(stem)
      || ALL_VERBS.has(`${stem}ed`) || ALL_VERBS.has(`${stem}d`);
    if (known) {
      warnings.push(`${liveLabel}: bullet opens with third-person "${word}" - current roles use the bare form`);
    }
  }



  if (/\.edu\b/i.test(String(data.email ?? ''))) {
    warnings.push('email is a student address - the guide asks for a professional non-student email');
  }

  const doubled = content.match(/\b(\w+)\s+\1\b/gi);
  if (doubled) warnings.push(`doubled word(s): ${[...new Set(doubled)].slice(0, 5).join(', ')}`);

  // 10. Link validity.
  if (checkLinks) {
    const urls = [...new Set((data.links ?? []).map((l) => l.url).filter((u) => /^https?:/i.test(u ?? '')))];
    for (const result of await Promise.all(urls.map(checkLink))) {
      if (result.ok) notes.push(`link ok (${result.status}) ${result.url}`);
      else warnings.push(`link check failed (${result.status}) ${result.url}`);
    }
  }

  return { errors, warnings, notes };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const strict = process.argv.includes('--strict') || process.env.npm_config_strict === 'true';
  const result = await verify({ strict, variant: variantFromArgv() });
  for (const n of result.notes) console.log(`  ${n}`);
  for (const w of result.warnings) console.log(`WARN  ${w}`);
  for (const e of result.errors) console.log(`FAIL  ${e}`);
  const mode = strict ? ' (strict)' : '';
  if (result.errors.length) {
    console.log(`\nverify failed${mode}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
    process.exit(1);
  }
  console.log(`\nverify passed${mode}: ${result.warnings.length} warning(s)`);
}

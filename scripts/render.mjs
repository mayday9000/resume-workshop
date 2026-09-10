// resume/resume.md -> build/resume.html -> build/resume.pdf
// The same HTML feeds the app preview and the PDF, so preview == export.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { chromium } from 'playwright';
import { root, p, resolveTarget, variantFromArgv } from './target.mjs';

const md = new MarkdownIt({
  html: true,
  breaks: true,        // a newline inside an entry becomes a line break
  linkify: false,      // only explicit [label](url) links, keeps extraction clean
  typographer: false,  // no smart quotes; ATS parsers prefer plain characters
});

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// An entry's first line may end in " | dates". Split it into a flex row so the dates sit flush
// right, the way a Word right tab stop does in the UNC Charlotte business format. DOM order stays
// left-then-right, so extracted text reads "Employer, City, ST  Jun 2021 - Dec 2024" as expected.
function layoutEntries(html) {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (whole, inner) => {
    const br = inner.indexOf('<br>');
    const first = br === -1 ? inner : inner.slice(0, br);
    // .row is a block-level flex container, so the <br> that followed it would double the break.
    const rest = br === -1 ? '' : inner.slice(br).replace(/^<br>\s*/, '');
    const at = first.lastIndexOf(' | ');
    if (at === -1) return whole;
    const left = first.slice(0, at).trim();
    const right = first.slice(at + 3).trim();
    return `<p class="entry"><span class="row"><span class="what">${left}</span>` +
           `<span class="when">${right}</span></span>${rest}</p>`;
  });
}

// Highlight [[confirm: ...]] markers on screen; print CSS hides the styling.
const markConfirms = (html) =>
  html.replace(/\[\[confirm:([^\]]*)\]\]/g, (_, body) => `<span class="confirm">[[confirm:${body}]]</span>`);

function buildContact(data) {
  const parts = [];
  if (data.location) parts.push(escapeHtml(data.location));
  if (data.email) parts.push(escapeHtml(data.email));
  if (data.phone) parts.push(escapeHtml(data.phone));
  for (const link of data.links ?? []) {
    const label = escapeHtml(link.label ?? link.url);
    parts.push(link.url ? `<a href="${escapeHtml(link.url)}">${label}</a>` : label);
  }
  return markConfirms(parts.join(' &nbsp;|&nbsp; '));
}

export async function render({ variant = null } = {}) {
  const target = resolveTarget(variant);

  let raw;
  try {
    raw = await readFile(target.source, 'utf8');
  } catch {
    throw new Error(`no such resume: ${path.relative(root, target.source)}`);
  }
  const { data, content } = matter(raw);

  if (!data.name) throw new Error(`${path.relative(root, target.source)} frontmatter is missing "name"`);

  const [template, css] = await Promise.all([
    readFile(p('templates', 'resume.html'), 'utf8'),
    readFile(p('templates', 'resume.css'), 'utf8'),
  ]);

  const html = template
    .replace('{{CSS}}', () => css)
    .replace(/\{\{NAME\}\}/g, () => escapeHtml(data.name))
    .replace('{{CONTACT}}', () => buildContact(data))
    .replace('{{BODY}}', () => markConfirms(layoutEntries(md.render(content))));

  await mkdir(p('build'), { recursive: true });
  await writeFile(target.html, html, 'utf8');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(target.html).href, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: target.pdf,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }

  return { html: target.html, pdf: target.pdf, variant: target.variant };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  render({ variant: variantFromArgv() })
    .then((out) => console.log(`rendered${out.variant ? ' [' + out.variant + ']' : ''}\n  ${path.relative(root, out.html)}\n  ${path.relative(root, out.pdf)}`))
    .catch((err) => {
      console.error(`render failed: ${err.message}`);
      process.exit(1);
    });
}

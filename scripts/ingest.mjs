// inputs/*.docx|*.pdf -> text -> resume/master.md (managed block) + resume/resume.md contact fields.
//
// Additive only. The extracted text lands between ingest markers in master.md, so re-running
// replaces that block and never touches anything written by hand. Contact fields in resume.md are
// filled only where a [[confirm]] placeholder is still sitting, so a confirmed value is never
// overwritten. Nothing here infers or rewrites content; curation is a human decision.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => path.join(root, ...s);

const START = '<!-- ingest:start -->';
const END = '<!-- ingest:end -->';

async function textFromDocx(file) {
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.extractRawText({ path: file });
  return value;
}

async function textFromPdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), isEvalSupported: false });
  const doc = await task.promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
  }
  await task.destroy();
  return text;
}

export function parseContact(text) {
  const find = (re) => (text.match(re) ?? [])[0];
  const linkedin = find(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  const github = find(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i);
  return {
    email: find(/[\w.+-]+@[\w-]+\.[\w.]{2,}/),
    phone: find(/\(?\d{3}\)?[\s.\u2013-]*\d{3}[\s.\u2013-]*\d{4}/),
    location: find(/\b[A-Z][a-zA-Z]+(?:[ -][A-Z][a-zA-Z]+)*,\s*[A-Z]{2}\b/),
    linkedin: linkedin ? `https://${linkedin.replace(/^https?:\/\//i, '')}` : undefined,
    github: github ? `https://${github.replace(/^https?:\/\//i, '')}` : undefined,
  };
}

function upsertBlock(md, block) {
  const fresh = `${START}\n${block}\n${END}`;
  if (md.includes(START) && md.includes(END)) {
    return md.replace(new RegExp(String.raw`${START}[\s\S]*?${END}`), () => fresh);
  }
  return `${md.trimEnd()}\n\n${fresh}\n`;
}

export async function ingest() {
  const files = (await readdir(p('inputs')))
    .filter((f) => /\.(docx|pdf)$/i.test(f) && !f.startsWith('~$'));

  if (!files.length) {
    return { files: [], note: 'no .docx or .pdf found in inputs/' };
  }

  const sections = [];
  const contacts = [];
  for (const file of files) {
    const full = p('inputs', file);
    const text = /\.docx$/i.test(file) ? await textFromDocx(full) : await textFromPdf(full);
    const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    contacts.push(parseContact(clean));
    sections.push(
      `### Verbatim extract — \`inputs/${file}\`\n\n` +
      `Extracted ${new Date().toLocaleDateString('en-CA')}. Original is read-only; nothing below is cut ` +
      `or reworded. Promote lines into the curated one-pager by hand.\n\n` +
      '```text\n' + clean.replace(/```/g, "'''") + '\n```'
    );
  }

  const block =
    `## Ingested source resumes\n\n` +
    `Managed by \`npm run ingest\` — edits between these markers are overwritten on the next run.\n\n` +
    sections.join('\n\n');

  const masterPath = p('resume', 'master.md');
  await writeFile(masterPath, upsertBlock(await readFile(masterPath, 'utf8'), block), 'utf8');

  // Fill resume.md contact fields that are still placeholders.
  const contact = Object.assign({}, ...contacts.reverse());
  const resumePath = p('resume', 'resume.md');
  let resume = await readFile(resumePath, 'utf8');
  const filled = [];
  for (const key of ['email', 'phone', 'location']) {
    if (!contact[key]) continue;
    const re = new RegExp(String.raw`^(${key}:\s*)"?\[\[confirm:[^\]]*\]\]"?\s*$`, 'm');
    if (re.test(resume)) {
      resume = resume.replace(re, `$1"${contact[key]}"`);
      filled.push(`${key}=${contact[key]}`);
    }
  }
  for (const [key, label] of [['linkedin', 'LinkedIn'], ['github', 'GitHub']]) {
    if (contact[key] && !resume.includes(contact[key])) {
      resume = resume.replace(/^links:\s*$/m, `links:\n  - label: ${label}\n    url: ${contact[key]}`);
      filled.push(`${key}=${contact[key]}`);
    }
  }
  await writeFile(resumePath, resume, 'utf8');

  return { files, contact, filled };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const out = await ingest();
  if (out.note) console.log(out.note);
  else {
    console.log(`ingested: ${out.files.join(', ')}`);
    console.log(`contact found: ${JSON.stringify(out.contact)}`);
    console.log(out.filled.length ? `resume.md filled: ${out.filled.join(', ')}` : 'resume.md unchanged (no placeholders left)');
  }
  process.exit(0);
}

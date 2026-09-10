// Resolves which resume a command acts on.
//
// No variant  -> resume/resume.md            -> build/resume.{html,pdf}
// --variant X -> resume/variants/X.md        -> build/X.{html,pdf}
//
// Variants exist because one page cannot serve two different job postings. They all draw from the
// same resume/master.md; only the curated selection differs.

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const p = (...s) => path.join(root, ...s);

/** Lowercase, hyphenated, safe to use as a filename and a git tag. */
export const slugify = (s) =>
  String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function resolveTarget(variant) {
  if (!variant) {
    return { variant: null, name: 'resume', source: p('resume', 'resume.md'), html: p('build', 'resume.html'), pdf: p('build', 'resume.pdf') };
  }
  const slug = slugify(variant);
  if (!slug) throw new Error(`invalid variant name: ${variant}`);
  return {
    variant: slug,
    name: slug,
    source: p('resume', 'variants', `${slug}.md`),
    html: p('build', `${slug}.html`),
    pdf: p('build', `${slug}.pdf`),
    job: p('jobs', `${slug}.md`),
  };
}

/** Reads `--variant x` / `--variant=x` out of an argv array. */
export function variantFromArgv(argv = process.argv.slice(2)) {
  const eq = argv.find((a) => a.startsWith('--variant='));
  if (eq) return eq.slice('--variant='.length);
  const i = argv.indexOf('--variant');
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('-')) return argv[i + 1];
  // npm run render --variant sales lands here instead of in argv
  return process.env.npm_config_variant || null;
}

export async function listVariants() {
  const dir = p('resume', 'variants');
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
}

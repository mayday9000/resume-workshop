// Ships a dated PDF: render -> verify --strict -> copy to exports/ -> commit -> tag.
// Strict means every [[confirm]] marker must be resolved first, so nothing unverified leaves here.

import { copyFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { render } from './render.mjs';
import { verify } from './verify.mjs';
import { root, p, resolveTarget, variantFromArgv, slugify as slug } from './target.mjs';

const run = promisify(execFile);
const git = (...args) => run('git', args, { cwd: root });

export async function exportResume(rawLabel, { variant = null } = {}) {
  const target = resolveTarget(variant);
  const label = slug(rawLabel || '');
  if (!label) throw new Error('a label is required, e.g. `npm run export -- hackathon-clt-v1`');

  await render({ variant });

  const { errors, warnings } = await verify({ strict: true, variant });
  if (errors.length) {
    throw new Error(`verify --strict failed, nothing exported:\n  - ${errors.join('\n  - ')}`);
  }

  // Local date, not UTC: toISOString() rolls over at 8pm Eastern and misdates the export.
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rel = path.join('exports', `${date}-${label}.pdf`);
  await mkdir(p('exports'), { recursive: true });
  await copyFile(target.pdf, p(rel));

  await git('add', '-A');
  try {
    await git('commit', '-m', `export: ${label}`);
  } catch (err) {
    if (!/nothing to commit/i.test(err.stdout ?? '')) throw err;
  }

  // Check first rather than tagging and catching: a swallowed error here used to silently
  // rename the tag, which defeats the point of a traceable export.
  const taken = (await git('tag', '--list', label)).stdout.trim();
  const tag = taken ? `${label}-${date}` : label;
  await git('tag', ...(taken ? ['-f', tag] : [tag]));

  const { stdout: hash } = await git('rev-parse', '--short', 'HEAD');
  return { path: rel, absolute: p(rel), tag, renamed: Boolean(taken), commit: hash.trim(), warnings, variant: target.variant };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const variant = variantFromArgv();
  const argv = process.argv.slice(2);
  const label = argv
    .filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '--variant')
    .join(' ');
  try {
    const out = await exportResume(label, { variant });
    for (const w of out.warnings) console.log(`WARN  ${w}`);
    console.log(`exported ${out.path}`);
    console.log(`  absolute  ${out.absolute}`);
    console.log(`  commit    ${out.commit}`);
    console.log(`  tag       ${out.tag}${out.renamed ? ' (label was already taken)' : ''}`);
    process.exit(0);
  } catch (err) {
    console.error(`export failed: ${err.message}`);
    process.exit(1);
  }
}

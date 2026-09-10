// Saves a job posting to jobs/<slug>.md so a resume variant can be tailored against it.
//
// Uses a real browser rather than fetch(): Workday, Greenhouse, Lever and Yello all render the
// posting client-side, so a plain HTTP GET returns an empty shell.
//
//   npm run job -- https://example.com/posting            (slug inferred from the page title)
//   npm run job -- https://example.com/posting my-slug

import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { root, p, slugify } from './target.mjs';

const BOILERPLATE = [
  /^skip to main content$/i, /^sign in$/i, /^apply$/i, /^follow us$/i, /^privacy policy$/i,
  /^© \d{4}/, /^powered by /i, /^language preference$/i, /^read more$/i, /^careers hub$/i,
  /^search for jobs$/i, /^introduce yourself$/i,
];

export async function fetchJob(url, slugHint) {
  if (!/^https?:\/\//i.test(url)) throw new Error(`not a URL: ${url}`);

  const browser = await chromium.launch();
  let data;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500); // late-hydrating job boards
    data = await page.evaluate(() => ({
      title: document.title || '',
      heading: document.querySelector('h1, h2')?.innerText?.trim() || '',
      text: document.body.innerText,
    }));
  } finally {
    await browser.close();
  }

  const lines = data.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !BOILERPLATE.some((re) => re.test(l)));
  // Collapse the runs of duplicate lines these boards emit (requirements repeated per section).
  const body = lines.filter((l, i) => l !== lines[i - 1]).join('\n');

  const title = data.heading || data.title.split(/[|–-]/)[0].trim() || 'job posting';
  const slug = slugify(slugHint || title);
  if (!slug) throw new Error('could not derive a slug; pass one explicitly');

  const doc = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `url: ${url}`,
    `fetched: ${new Date().toISOString().slice(0, 10)}`,
    '---',
    '',
    `# ${title}`,
    '',
    'Captured verbatim from the posting. Treat as the requirements the variant is written against.',
    '',
    '```text',
    body.replace(/```/g, "'''"),
    '```',
    '',
  ].join('\n');

  await mkdir(p('jobs'), { recursive: true });
  const out = p('jobs', `${slug}.md`);
  await writeFile(out, doc, 'utf8');
  return { slug, title, url, path: out, chars: body.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [url, slugHint] = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (!url) {
    console.error('usage: npm run job -- <url> [slug]');
    process.exit(1);
  }
  try {
    const out = await fetchJob(url, slugHint);
    console.log(`saved ${path.relative(root, out.path)}`);
    console.log(`  title ${out.title}`);
    console.log(`  slug  ${out.slug}  (build a variant with: npm run render -- --variant ${out.slug})`);
    console.log(`  ${out.chars} characters captured`);
    process.exit(0);
  } catch (err) {
    console.error(`fetch-job failed: ${err.message}`);
    process.exit(1);
  }
}

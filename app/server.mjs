// Resume workshop app: chat on the left, live preview on the right, git history below.
//
// Chat runs the local `claude` CLI as a child process rather than the Agent SDK, so it uses the
// existing CLI login instead of an ANTHROPIC_API_KEY. The CLI ships as a native binary, so we spawn
// it directly with an argv array — no shell, so nothing in a message is interpreted as syntax.
//
// Everything is variant-aware: no variant edits resume/resume.md, a variant edits
// resume/variants/<slug>.md. Each variant keeps its own chat session so their memories stay apart.

import express from 'express';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { render } from '../scripts/render.mjs';
import { verify } from '../scripts/verify.mjs';
import { exportResume } from '../scripts/export.mjs';
import { fetchJob } from '../scripts/fetch-job.mjs';
import { root, p, resolveTarget, listVariants, slugify } from '../scripts/target.mjs';

const run = promisify(execFile);
const git = (...args) => run('git', args, { cwd: root, maxBuffer: 1024 * 1024 * 8 });
const PORT = Number(process.env.PORT ?? 4000);

// Only these tools, and Bash only for the command families the loop needs.
const ALLOWED_TOOLS = [
  'Read', 'Edit', 'Write', 'Glob', 'Grep',
  'Bash(npm run render:*)',
  'Bash(npm run verify:*)',
  'Bash(git:*)',
];

const systemAppend = (target) => [
  `You are editing ${path.relative(root, target.source).replace(/\\/g, '/')}.`,
  'Follow CLAUDE.md and reference/uncc-resume-standards.md, which is the UNC Charlotte house style.',
  'Make the change requested, then run',
  target.variant
    ? `\`npm run render -- --variant ${target.variant}\` and \`npm run verify -- --variant ${target.variant}\`.`
    : '`npm run render` and `npm run verify`.',
  'Treat verify warnings as work to do, not noise: they encode the Career Guide rules.',
  'If verify fails, fix and re-run. Reply with a one-line summary and a commit message on the last',
  'line prefixed `COMMIT:`.',
].join(' ');

// The CLI is a native binary; find it so we never need shell:true.
function resolveClaude() {
  if (process.env.CLAUDE_CLI) return process.env.CLAUDE_CLI;
  const bin = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const rel = path.join('node_modules', '@anthropic-ai', 'claude-code', 'bin', bin);
  const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const roots = [
    path.join(process.env.APPDATA ?? '', 'npm'),
    path.join(home, '.claude', 'local'),
    path.join(home, '.npm-global'),
    '/usr/local',
    '/usr/local/lib',
    '/opt/homebrew',
  ];
  for (const r of roots) {
    if (!r) continue;
    const candidate = path.join(r, rel);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const CLAUDE_CLI = resolveClaude();
const sessions = new Map(); // variant key -> claude session id, so each variant has its own memory
const keyOf = (variant) => variant ?? '';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(p('app', 'public')));
app.use('/build', express.static(p('build'), {
  etag: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
}));

// ---------------------------------------------------------------- chat

function runClaude(message, target, resumeId) {
  const args = [
    '-p', message,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--model', process.env.RESUME_MODEL ?? 'sonnet',
    '--strict-mcp-config',          // no MCP servers: smaller prompt, lower cost
    '--disable-slash-commands',
    '--setting-sources', 'project', // loads CLAUDE.md and .claude/
    '--permission-mode', 'acceptEdits',
    '--append-system-prompt', systemAppend(target),
    '--allowedTools', ...ALLOWED_TOOLS,
    '--max-turns', '30',
  ];
  if (resumeId) args.push('--resume', resumeId);
  else {
    const fresh = randomUUID();
    sessions.set(keyOf(target.variant), fresh);
    args.push('--session-id', fresh);
  }

  // Drop an inherited bypassPermissions so the app's own mode always wins.
  const env = { ...process.env };
  delete env.CLAUDE_CODE_PERMISSION_MODE;

  if (CLAUDE_CLI) return spawn(CLAUDE_CLI, args, { cwd: root, env });
  return spawn('claude', args, { cwd: root, env, shell: true }); // last resort
}

const sseHead = (res) => res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
});

/** Runs one chat turn to completion, then renders, verifies and commits. Streams over SSE. */
async function chatTurn(res, message, variant) {
  const target = resolveTarget(variant);
  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

  const attempt = (resumeId) => {
    const child = runClaude(message, target, resumeId);
    let buffer = '';
    let finalText = '';
    let stderr = '';
    let sawResult = false;

    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }

        if (msg.type === 'stream_event') {
          const ev = msg.event;
          if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            send('text', { text: ev.delta.text });
          }
        } else if (msg.type === 'assistant') {
          for (const block of msg.message?.content ?? []) {
            if (block.type !== 'tool_use') continue;
            const raw = block.name === 'Bash'
              ? String(block.input?.command ?? '')
              : String(block.input?.file_path ?? block.input?.pattern ?? '');
            const detail = block.name === 'Bash' ? raw.slice(0, 60) : path.basename(raw);
            send('status', { text: detail ? `${block.name}: ${detail}` : block.name });
          }
        } else if (msg.type === 'result') {
          sawResult = true;
          if (msg.session_id) sessions.set(keyOf(target.variant), msg.session_id);
          finalText = String(msg.result ?? '');
          if (typeof msg.total_cost_usd === 'number') send('cost', { usd: msg.total_cost_usd });
        }
      }
    });

    return new Promise((resolve) => {
      child.on('error', (err) => resolve({ ok: false, error: err.message, sawResult }));
      child.on('close', (code) => resolve({ ok: code === 0 && sawResult, code, finalText, stderr, sawResult }));
    });
  };

  let out = await attempt(sessions.get(keyOf(target.variant)));
  // A stale session id is the one failure worth retrying: start a fresh session once.
  if (!out.ok && sessions.get(keyOf(target.variant)) && !out.sawResult) {
    send('status', { text: 'session expired, starting a new one' });
    sessions.delete(keyOf(target.variant));
    out = await attempt(null);
  }

  if (!out.ok) {
    send('error', { text: String(out.error ?? out.stderr ?? `claude exited with code ${out.code}`).slice(0, 800) });
    return false;
  }

  const commitLine = [...out.finalText.matchAll(/^COMMIT:\s*(.+)$/gm)].pop();
  const summary = out.finalText.replace(/^COMMIT:.*$/gm, '').trim();
  send('summary', { text: summary });

  send('status', { text: 'rendering' });
  await render({ variant });
  send('status', { text: 'verifying' });
  const { errors, warnings } = await verify({ strict: false, checkLinks: false, variant });
  send('verify', { errors, warnings });

  if (errors.length) {
    send('status', { text: `verify failed: ${errors.length} error(s), not committed` });
    send('reload', { variant });
    return false;
  }

  const { stdout: dirty } = await git('status', '--porcelain');
  if (dirty.trim()) {
    const subject = commitLine?.[1]?.trim() || `content: ${message.slice(0, 60)}`;
    await git('add', '-A');
    await git('commit', '-m', subject);
    const { stdout: hash } = await git('rev-parse', '--short', 'HEAD');
    send('status', { text: `committed ${hash.trim()}` });
  } else {
    send('status', { text: 'no file changes to commit' });
  }
  send('reload', { variant });
  return true;
}

app.post('/chat', async (req, res) => {
  const message = String(req.body?.message ?? '').trim();
  if (!message) return res.status(400).json({ error: 'message required' });
  const variant = req.body?.variant ? slugify(req.body.variant) : null;

  sseHead(res);
  try {
    await chatTurn(res, message, variant);
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ text: err.message })}\n\n`);
  }
  res.end();
});

// Paste a job posting URL -> capture it -> tailor a variant against it.
app.post('/job', async (req, res) => {
  const url = String(req.body?.url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'a http(s) URL is required' });

  sseHead(res);
  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    send('status', { text: 'fetching posting in a headless browser' });
    const job = await fetchJob(url, req.body?.slug);
    send('status', { text: `saved jobs/${job.slug}.md — ${job.chars} chars` });
    send('job', { slug: job.slug, title: job.title });

    const rel = `jobs/${job.slug}.md`;
    const exists = existsSync(resolveTarget(job.slug).source);
    const instruction = [
      `Read ${rel} (a job posting) and resume/master.md (the full inventory).`,
      exists
        ? `Update the existing resume/variants/${job.slug}.md so it targets that posting.`
        : `Create resume/variants/${job.slug}.md: a one-page resume selected from master.md and written for that posting.`,
      'Follow every rule in CLAUDE.md, especially rule 3 (never invent facts, use [[confirm]] markers)',
      'and rule 6 (target lens). Copy the frontmatter contact block from an existing variant.',
      'Prioritise the evidence that posting actually asks for.',
    ].join(' ');

    await chatTurn(res, instruction, job.slug);
  } catch (err) {
    send('error', { text: err.message });
  }
  res.end();
});

// ---------------------------------------------------------------- variants & versions

app.get('/variants', async (_req, res) => {
  try {
    res.json({ variants: await listVariants() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const isHash = (h) => /^[0-9a-f]{4,40}$/i.test(h);
const sourceRel = (variant) => path.relative(root, resolveTarget(variant).source).replace(/\\/g, '/');

app.get('/versions', async (_req, res) => {
  try {
    const { stdout } = await git('log', '--format=%h|%s|%cr', '-50');
    const versions = stdout.split('\n').filter(Boolean).map((line) => {
      const [hash, ...rest] = line.split('|');
      const relative = rest.pop();
      return { hash, subject: rest.join('|'), relative };
    });
    res.json({ versions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/diff/:hash', async (req, res) => {
  if (!isHash(req.params.hash)) return res.status(400).type('text/plain').send('bad hash');
  const rel = sourceRel(req.query.variant ? slugify(String(req.query.variant)) : null);
  try {
    const { stdout } = await git('diff', req.params.hash, 'HEAD', '--', rel);
    res.type('text/plain').send(stdout || `(no changes to ${rel} between this commit and HEAD)`);
  } catch (err) {
    res.status(500).type('text/plain').send(err.message);
  }
});

app.post('/restore/:hash', async (req, res) => {
  const { hash } = req.params;
  if (!isHash(hash)) return res.status(400).json({ error: 'bad hash' });
  const variant = req.body?.variant ? slugify(req.body.variant) : null;
  const rel = sourceRel(variant);
  try {
    await git('checkout', hash, '--', rel);
    await render({ variant });
    const { errors, warnings } = await verify({ strict: false, checkLinks: false, variant });
    const { stdout: dirty } = await git('status', '--porcelain');
    let commit = null;
    if (dirty.trim()) {
      await git('add', '-A');
      await git('commit', '-m', `restore: ${rel} from ${hash}`);
      commit = (await git('rev-parse', '--short', 'HEAD')).stdout.trim();
    }
    res.json({ ok: true, commit, errors, warnings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/export', async (req, res) => {
  try {
    const variant = req.body?.variant ? slugify(req.body.variant) : null;
    const out = await exportResume(String(req.body?.label ?? ''), { variant });
    res.json({ ok: true, ...out });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  cli: CLAUDE_CLI ?? 'claude (via shell)',
  cliFound: Boolean(CLAUDE_CLI),
  sessions: Object.fromEntries(sessions),
}));

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`resume workshop -> ${url}`);
  console.log(CLAUDE_CLI ? `claude cli: ${CLAUDE_CLI}` : 'claude cli: not found on disk, falling back to PATH via shell');
  if (process.env.NO_OPEN !== '1') {
    const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref();
  }
});

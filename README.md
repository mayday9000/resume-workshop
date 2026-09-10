# Resume Workshop

Markdown in, a verified one-page PDF out, with a chat app for editing it and a git history of every
version. Built to be pointed at a specific job posting rather than to produce one generic resume.

The point is that the rules are **checked, not remembered**. `npm run verify` reads the rendered PDF
back and fails on things a human reviewer would catch on a bad day: two pages, a bare year with no
month, a section that is not reverse chronological, a bullet that opens with "Responsible for", an
em dash, an entry missing its city, half a page of blank space at the bottom.

## Setup

```
npm install
npx playwright install chromium    # only if rendering complains
npm run dev                        # http://localhost:4000
```

Requires Node 20 or newer. The chat panel additionally requires the Claude Code CLI, see below.

## Use it

```
npm run render     # resume/resume.md -> build/resume.html -> build/resume.pdf
npm run verify     # check the rendered PDF; --strict also fails on [[confirm]] markers
npm run export     # verify strict, copy to exports/, commit, tag
npm run ingest     # pull inputs/*.docx|pdf into resume/master.md
npm run job -- <url> [slug]        # capture a job posting into jobs/
```

Replace `resume/resume.md` with your own. It ships with a fictional example so the pipeline runs on a
fresh clone. `resume/master.md` is the uncut inventory of everything you have ever done; the
one-pager is curated from it.

## Variants

One page cannot serve two different postings, so each target gets its own file drawn from the same
master inventory.

```
npm run job -- "https://example.com/posting" acme-swe   # capture the posting
npm run render -- --variant acme-swe                     # -> build/acme-swe.pdf
npm run verify -- --variant acme-swe --strict
npm run export -- --variant acme-swe acme-swe-v1
```

Postings are fetched with a real browser, because Workday, Greenhouse and Yello all render listings
client side and return an empty shell to a plain HTTP GET.

## The app

`npm run dev` gives you a chat panel on the left, a live preview on the right, and git history along
the bottom with Diff and Restore per commit. A dropdown picks which variant you are editing, and
**From job URL** captures a posting and tailors a new variant against it in one step.

Chat drives the **Claude Code CLI as a child process**, not an API SDK, so it uses your existing CLI
login rather than an API key. If the CLI is not installed the rest of the tool still works; you just
lose the chat panel. Set `CLAUDE_CLI` if your install lives somewhere unusual, and `RESUME_MODEL` to
change the model.

## What gets checked

`verify` reads the actual rendered PDF, not the markdown, so it catches what a reader would see.

| Check | Fails or warns |
|---|---|
| Exactly one page | fails |
| Text extracts cleanly, no images or tables | fails |
| Name and email present in the PDF text | fails |
| Required section headings present | fails |
| Em dashes or en dashes | fails |
| `[[confirm]]` markers | warns, fails under `--strict` |
| Reverse chronological within each section | warns |
| Bullets open with a power action verb | warns |
| Diluted phrases ("responsible for") | warns |
| Bare year with no month | warns |
| Experience entry missing city and state | warns |
| Third-person verbs on a current role | warns |
| First-person pronouns | warns |
| Bottom whitespace over 1in | warns |
| Doubled words | warns |
| Links in frontmatter resolve | warns |

## Standards

The formatting and content rules come from the UNC Charlotte Career Center's publicly published
career guide and resume approval checklist. They are a reasonable default for any US student or
early-career resume. See `reference/uncc-resume-standards.md` for the prose version and
`scripts/uncc-standards.mjs` for the machine-checked data, including the power verb list.

Swap in your own school's guidance by editing those two files. Nothing else depends on the specifics.

`CLAUDE.md` holds the operating rules the chat agent follows. Edit it to change how the agent
behaves.

## Layout

```
resume/resume.md          the curated one-pager
resume/master.md          uncut inventory, no length limit
resume/variants/<slug>.md one file per target posting
jobs/<slug>.md            captured job postings
templates/                HTML and print CSS
scripts/                  render, verify, export, ingest, job capture, standards
app/                      Express server and single-page UI
reference/                the standards this enforces
inputs/                   original resumes, read only
exports/                  dated PDFs
```

## License

No license file yet, which means all rights reserved by default. That is fine while the repo is
private. Add a LICENSE before making it public if you want others to be able to use it.

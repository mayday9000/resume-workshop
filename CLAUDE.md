# Resume Workshop

A local pipeline that turns `resume/resume.md` into a verified one-page Letter PDF, plus a small
Express app where you edit the resume by chatting and watch the preview update.

## Operating rules

1. **Source files in `inputs/` are read only.** Never edit them. The source of truth is
   `resume/resume.md` (the curated one-pager) plus `resume/master.md` (the full inventory, no length
   limit).
2. **Every content change follows one loop:** edit source, render, verify, commit. No exceptions.
   Commit prefixes: `content:`, `layout:`, `export:`, `restore:`, `chore:`.
3. **Never invent facts.** No metric, date, title, tool or outcome the candidate has not confirmed.
   If something is unknown write `[[confirm: what is unknown]]` inline. Markers are fine in a draft;
   `npm run verify --strict` (used by export) fails while any remain. This is the most important
   rule in the file: a fabricated number survives the resume and dies in the interview.
4. **Ask before removing** anything already on the page. Adding is fine; cutting needs a yes.
5. **One full page.** Letter, exactly one page, and it should fill the page. If it overflows,
   tighten bullets or cut the lowest-value lines and say what you cut. If the bottom is left blank,
   add real content from `master.md` or loosen `--line` and `--gap` in `templates/resume.css`.
   `npm run verify` reports bottom whitespace and warns past 1in.
6. **Format.** Serif, 11pt body, 18pt centered name, section headings in bold caps underlined to the
   text width, bold employer with the city following, dates flush right on the entry line via ` | `
   at the end of that line, italic job title on the next line, round bullets with a hanging indent,
   no end punctuation on bullets. Hyperlinks render blue and underlined, and Chromium keeps them as
   real link annotations in the PDF.
7. **Target lens.** Every variant is written against one posting saved in `jobs/`. Read that file
   before editing the variant. Technical targets want shipped projects, depth, tools actually used
   and links. Sales targets want revenue, rankings, quota, account counts and territory ownership.
   `master.md` holds everything; a variant only selects from it.
8. **Bullet format.** Open every bullet with a power action verb from `scripts/uncc-standards.mjs`.
   Formula: power verb, what you did, why, who with, the result. Quantify wherever a real number
   exists. Cut diluted phrases such as "responsible for" and "duties included". No first person.
9. **Follow the standards** in `reference/uncc-resume-standards.md`. In particular: reverse
   chronological within every section, university and degree spelled out in full, GPA only above
   3.0, a professional non-student email, and a city and state on every experience entry.
10. **ATS-safe.** Standard section headings, no tables, no multi-column core content, no icons, no
    contact details in a running page header or footer, text must extract cleanly.
11. **Consistency on every render:** date format, tense, punctuation, link validity, one page. Ended
    roles take past tense ("Closed"). Current roles take the **bare** form ("Own", "Build"), never
    third person ("Owns", "Builds").
12. **Every date carries a month.** "Aug 2022 - Jul 2023", never "2022 - 2023".
13. **No em dashes or en dashes.** Plain hyphens only. `npm run verify` fails on either character.
14. **Never volunteer a gap.** Write what the candidate built, not what they lacked. "With no
    assigned quota" reads to a hiring manager as "has never carried a number". If a metric does not
    exist, omit the frame rather than explaining its absence.
15. **Contact accuracy.** Pull from an existing resume, then confirm once. Never guess an email or
    phone number.

## Commands

- `npm run job -- <url> [slug]` - save a posting to `jobs/<slug>.md` (renders JS-heavy job boards)
- `npm run render` - `resume/resume.md` to `build/resume.html` and `build/resume.pdf`
- add `--variant <slug>` to render/verify/export to act on `resume/variants/<slug>.md`
- `npm run verify` - checks the rendered PDF (`--strict` also fails on `[[confirm]]` markers)
- `npm run dev` - starts the editing app on http://localhost:4000
- `npm run export` - verify strict, copy to `exports/`, commit, tag

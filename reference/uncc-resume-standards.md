# UNC Charlotte resume standards

Operational summary of the UNC Charlotte Career Guide 2024, the Career Center resume page, and the
Hire-A-Niner Resume Approval Checklist. Read this before editing any resume in this repo.

Derived from the UNC Charlotte Career Center's publicly published guidance. They are a sensible
default for any US student or early-career resume, not just that school's.

- Machine-checked data (verb list, diluted phrases, headings): `scripts/uncc-standards.mjs`
- If you have your own school's guide, put the specifics here and adjust the module to match.

`npm run verify` enforces everything marked **[checked]** below. The rest is judgement.

---

## Hard specs

| Element | Spec |
|---|---|
| Length | 1 page. 2 pages only with significant professional or leadership experience, or as a grad student. One page is the default here. **[checked]** |
| Font | Times New Roman, Calibri, Arial or similar |
| Body size | 10 to 12 pt (this repo uses 11pt) |
| Name size | 14 to 16 pt per the written spec; the sample resumes use 18pt |
| Margins | 0.5 to 1 inch (this repo uses 0.5in) |
| Pronouns | None. No I, me, we, my, them **[checked]** |
| Errors | Zero spelling or grammar errors. Doubled words are **[checked]**; a real spellcheck is not |
| Consistency | Identical header and font treatment throughout |
| Order | Reverse chronological **within every section** **[checked]** |

## Heading block

Name, city and state, phone, professional email, LinkedIn, personal website. Street address
optional. Use a **professional, non-student email**, not an `.edu` address **[checked]**.

## Education

- Spell out **University of North Carolina at Charlotte**, never "UNCC"
- Spell out the degree: "Bachelor of Science in Data Science", never "BS DS"
- Expected graduation month and year, right aligned
- Major, concentration, minor
- GPA only if above 3.0

## Experience

Every entry needs a position title, organization, city and state, a right-aligned date range, and
bullets underneath.

**Bullet formula:** power verb + what you did + why + who with + the result.

- Open every bullet with a power action verb **[checked]** against the guide's list
- Quantify wherever a real number exists. Never invent one (CLAUDE.md rule 3)
- Spell out technical terms and abbreviations. Leave nothing to the reader's imagination
- Cut diluted phrases: "responsible for", "in charge of", "duties included" **[checked]**
- For projects, describe scope briefly then focus on your contribution and the result
- For unrelated or part-time jobs, keep only the transferable skills

**Structural pattern worth using:** the strongest samples split experience into a
**Related Experience** section first and an **Additional Experience** section second, rather than one
flat list. This front-loads relevance while keeping each section reverse chronological.

## Section order by field

| Field | Order used by the guide's sample |
|---|---|
| Business, Financial Services, Logistics | Education, Related Experience, Additional Experience, Campus Involvement, Language Skills |
| Technology, Data, Analytics | Education, **Technical Skills**, Work Experience, Course Projects, Student Involvement |
| Engineering | Education, Related Coursework, Skills, Projects, Engineering Experience, Non-Engineering Experience, Leadership |
| Healthcare, Science, Research | Education, Healthcare Experience, Research Experience, Publications, Campus and Community Involvement |
| Arts, Media, Design | Education, Skills, Photography Experience, Projects, Exhibitions |
| Social Impact, Education, Nonprofit | Education, Licensure, Teaching Experience, Community Service, Leadership and Campus Experience |

**Rule of thumb:** technical fields put Skills immediately after Education, before any experience.
Non-technical fields put experience first and skills last, or omit skills entirely.

## Skills section

Two accepted shapes. Labeled sub-categories (`Languages:`, `Networking & Security:`,
`Design Software:`) for technical fields, or a single list of technical tools only. The engineering
sample is explicit: list technical skills, not soft skills. Proficiency can be annotated in
parentheses: `(proficient)`, `(familiar)`, `(fluent)`, `(basic)`.

## A note on school career portals

Some university job portals hold your first resume upload for staff review before you can apply to
anything through them. If yours does, budget a couple of days and read their checklist first. The
rules above are drawn from exactly that kind of checklist.

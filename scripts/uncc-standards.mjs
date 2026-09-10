// Resume standards drawn from the UNC Charlotte Career Guide 2024 and the Hire-A-Niner
// Resume Approval Checklist. Data lives here so verify.mjs and the editing agent share one source.
// See reference/uncc-resume-standards.md for the prose version and the citations.

/** The guide's complete power action verb list, by category. Bullets should open with one. */
export const POWER_VERBS = {
  communication: ['addressed', 'advertised', 'arranged', 'articulated', 'authored', 'collaborated', 'communicated', 'composed', 'condensed', 'conferred', 'consulted', 'conveyed', 'convinced', 'corresponded', 'debated', 'defined', 'described', 'discussed', 'drafted', 'edited', 'elicited', 'enlisted', 'explained', 'expressed', 'formulated', 'furnished', 'incorporated', 'influenced', 'interpreted', 'interviewed', 'lectured', 'listened', 'marketed', 'moderated', 'negotiated', 'observed', 'outlined', 'participated', 'presented', 'proposed', 'publicized', 'recruited', 'referred', 'reported', 'resolved', 'spoke', 'suggested', 'summarized', 'synthesized', 'translated', 'wrote'],
  creative: ['acted', 'combined', 'conceptualized', 'created', 'customized', 'displayed', 'drew', 'entertained', 'fashioned', 'illustrated', 'initiated', 'integrated', 'introduced', 'invented', 'modeled', 'modified', 'performed', 'photographed', 'revised', 'revitalized', 'shaped'],
  financial: ['adjusted', 'allocated', 'appraised', 'assessed', 'audited', 'balanced', 'budgeted', 'corrected', 'counted', 'estimated', 'prepared', 'reduced', 'regulated', 'retrieved'],
  helping: ['advocated', 'aided', 'answered', 'assisted', 'contributed', 'cooperated', 'counseled', 'demonstrated', 'educated', 'ensured', 'expedited', 'familiarized', 'furthered', 'helped', 'insured', 'intervened', 'prevented', 'provided', 'rehabilitated', 'represented', 'simplified', 'supplied', 'supported', 'volunteered'],
  leadership: ['administered', 'analyzed', 'appointed', 'approved', 'assigned', 'attained', 'authorized', 'chaired', 'considered', 'consolidated', 'contracted', 'controlled', 'converted', 'coordinated', 'decided', 'delegated', 'developed', 'directed', 'eliminated', 'emphasized', 'enforced', 'enhanced', 'established', 'executed', 'generated', 'handled', 'headed', 'hired', 'hosted', 'improved', 'implemented', 'led', 'managed', 'merged', 'motivated', 'organized', 'originated', 'oversaw', 'planned', 'prioritized', 'produced', 'recommended', 'replaced', 'restored', 'scheduled', 'secured', 'selected', 'streamlined', 'strengthened', 'supervised', 'transformed'],
  organization: ['cataloged', 'categorized', 'classified', 'coded', 'compiled', 'distributed', 'inspected', 'logged', 'maintained', 'monitored', 'obtained', 'ordered', 'processed', 'purchased', 'recorded', 'registered', 'reserved', 'responded', 'routed', 'screened', 'served', 'submitted', 'updated', 'validated', 'verified'],
  research: ['clarified', 'collected', 'compared', 'conducted', 'detected', 'determined', 'diagnosed', 'evaluated', 'examined', 'experimented', 'explored', 'extracted', 'gathered', 'identified', 'investigated', 'located', 'measured', 'researched', 'reviewed', 'searched', 'solved', 'studied', 'surveyed', 'systematized'],
  teaching: ['advised', 'coached', 'critiqued', 'enabled', 'encouraged', 'facilitated', 'focused', 'guided', 'individualized', 'informed', 'instilled', 'instructed', 'persuaded', 'simulated', 'taught', 'tested', 'trained', 'transmitted', 'tutored'],
  technical: ['adapted', 'applied', 'assembled', 'built', 'calculated', 'computed', 'conserved', 'constructed', 'designed', 'engineered', 'maintained', 'operated', 'printed', 'programmed', 'remodeled', 'specialized', 'upgraded', 'utilized'],
};

export const ALL_VERBS = new Set(Object.values(POWER_VERBS).flat());

/**
 * Present-tense forms for current roles. The guide's list is past tense, but a current role
 * takes present tense (rule 10), so accept the stem without the -ed/-d.
 */
export const PRESENT_FORMS = new Set(
  [...ALL_VERBS].flatMap((v) => {
    const out = [];
    if (v.endsWith('ied')) {
      const stem = v.slice(0, -3) + 'y';                 // simplified -> simplify
      out.push(stem, `${stem.slice(0, -1)}ies`);         // -> simplifies
    } else if (v.endsWith('ed')) {
      const bare = v.slice(0, -2);                       // managed -> manag
      const withE = v.slice(0, -1);                      // managed -> manage
      out.push(bare, withE, `${bare}s`, `${withE}s`);    // -> manages, supports
    }
    return out.filter((x) => x.length > 2);
  }),
);

/** Core sales verbs. The Career Guide list is field-agnostic and omits them. */
export const SALES_VERBS = new Set([
  'prospect', 'prospects', 'prospected', 'canvass', 'canvasses', 'canvassed',
  'pitch', 'pitches', 'pitched', 'demo', 'demos', 'demoed', 'quote', 'quotes', 'quoted',
  'renew', 'renews', 'renewed', 'upsell', 'upsells', 'upsold', 'onboard', 'onboards', 'onboarded',
]);

/** Technical and operations verbs. The 2024 guide's list predates most of this vocabulary. */
export const TECH_VERBS = new Set([
  'document', 'documents', 'documented', 'map', 'maps', 'mapped', 'deploy', 'deploys', 'deployed',
  'automate', 'automates', 'automated', 'ship', 'ships', 'shipped', 'refactor', 'refactors',
  'refactored', 'parse', 'parses', 'parsed', 'sync', 'syncs', 'synced', 'scrape', 'scrapes',
  'scraped', 'instrument', 'instruments', 'instrumented', 'architect', 'architects', 'architected',
  'add', 'adds', 'added', 'clean', 'cleans', 'cleaned', 'containerize', 'containerizes',
  'containerized', 'publish', 'publishes', 'published', 'optimize', 'optimizes', 'optimized',
  'benchmark', 'benchmarks', 'benchmarked', 'profile', 'profiles', 'profiled', 'scale', 'scales',
  'scaled', 'cache', 'caches', 'cached', 'index', 'indexes', 'indexed', 'query', 'queries',
  'queried', 'visualize', 'visualizes', 'visualized', 'aggregate', 'aggregates', 'aggregated',
  'join', 'joins', 'joined', 'debug', 'debugs', 'debugged', 'port', 'ports', 'ported',
]);

/** Irregulars and common resume openers the guide's list implies but does not spell out. */
export const EXTRA_VERBS = new Set([
  'lead', 'leads', 'oversee', 'oversees', 'run', 'runs', 'ran', 'own', 'owns', 'owned',
  'build', 'builds', 'sell', 'sells', 'sold', 'close', 'closes', 'closed', 'win', 'wins', 'won',
  'grow', 'grows', 'grew', 'rank', 'ranks', 'ranked', 'open', 'opens', 'opened', 'clear', 'clears',
  'cleared', 'partner', 'partners', 'partnered', 'migrate', 'migrates', 'migrated', 'found',
  'founded', 'launch', 'launches', 'launched', 'retain', 'retains', 'retained', 'support',
  'supports', 'exceed', 'exceeds', 'exceeded', 'deliver', 'delivers', 'delivered',
]);

/** Diluted phrases the guide tells you to avoid outright. */
export const DILUTED_PHRASES = [
  'responsible for',
  'in charge of',
  'duties included',
  'tasked with',
  'worked on',
  'helped with',
  'various tasks',
  'assisted in the',
];

/** Section headers the guide's six sample resumes use. */
export const KNOWN_HEADINGS = [
  'Education', 'Experience', 'Work Experience', 'Related Experience', 'Additional Experience',
  'Skills', 'Technical Skills', 'Specific Skills', 'Projects', 'Course Projects', 'Licensure',
  'Related Coursework', 'Publications', 'Exhibitions', 'Volunteer Experience', 'Community Service',
  'Campus Involvement', 'Student Involvement', 'Leadership', 'Language Skills', 'Computer Skills',
  'Certifications', 'Research Experience',
];

/** Returns true when a bullet opens with an acceptable action verb. */
export function startsWithPowerVerb(bullet) {
  const first = bullet
    .replace(/^\*\*/, '')                 // bold markers
    .replace(/[^A-Za-z].*$/, '')          // first word only
    .toLowerCase();
  if (!first) return false;
  return ALL_VERBS.has(first) || PRESENT_FORMS.has(first) || EXTRA_VERBS.has(first)
    || SALES_VERBS.has(first) || TECH_VERBS.has(first);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Parses the trailing "| Jun 2021 - Dec 2024" of an entry line into a sortable end date.
 * "Present" sorts highest. Returns null when there is no parseable date.
 */
export function entryEndDate(line) {
  const at = line.lastIndexOf(' | ');
  if (at === -1) return null;
  const range = line.slice(at + 3).trim();
  if (/present/i.test(range)) return Number.MAX_SAFE_INTEGER;
  const parts = [...range.matchAll(/([A-Za-z]{3,9})?\s*(\d{4})/g)];
  if (!parts.length) return null;
  const [, mon, year] = parts[parts.length - 1];
  const m = mon ? MONTHS.indexOf(mon.slice(0, 3).toLowerCase()) : 11;
  return Number(year) * 12 + (m === -1 ? 11 : m);
}

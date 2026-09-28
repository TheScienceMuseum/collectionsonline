'use strict';

/**
 * Fetch a Wikipedia article intro (summary) for use as INPUT to the
 * writer. Not to be confused with lib/ai/external-tools/wikipedia.js,
 * which fetches the FULL article for on-demand verify-only claim
 * checking with an Anthropic judge; this one is lightweight input-mode
 * fetching of just the intro paragraphs, sized for including in the
 * writer's user prompt.
 *
 * Two article-resolution strategies, tried in order:
 *
 *   1. Preferred: Wikidata sitelink — if the subject has a Q code,
 *      wbgetentities returns the `enwiki` sitelink directly, which is
 *      the exact Wikipedia article title. Zero ambiguity, one round
 *      trip.
 *
 *   2. Fallback: title search by name — if no Q code (or the sitelink
 *      lookup fails), fall through to a MediaWiki search query. Can
 *      pick the wrong article on ambiguous names ("Lipton" the tea
 *      brand vs "Lipton" the surname); accept it — the caller can
 *      inspect the returned title if it looks off.
 *
 * Returns { title, url, extract } or null if nothing usable was found.
 * `extract` is plain text (no wiki markup), assembled from the full
 * article's sections in priority order until ~8000 chars are used.
 * The Lead is always included first; then HIGH-priority sections
 * (History / Origins / Development / early biography); then MEDIUM
 * (Marketing, Today, Products); LOW-priority sections fill remaining
 * budget; SKIP sections (References, See also, individual product
 * subsections, tourism trivia) are dropped regardless of budget.
 *
 * Why prioritise rather than straight-truncate: for a well-known
 * subject like Lipton, the article's Marketing section carries the
 * 1914 Melbourne-Sydney flight sponsorship story — exactly the
 * kind of narrative colour a museum biography wants. Straight
 * truncation at 8000 chars stops mid-way through product-catalogue
 * subsections and misses Marketing entirely. Prioritisation
 * promotes Marketing above product-catalogue trivia and preserves
 * the character-driven content.
 */

const USER_AGENT = 'collectionsonline-ai-biographies (contact@sciencemuseumgroup.org.uk)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const REQUEST_TIMEOUT_MS = 8000;
const EXTRACT_MAX_CHARS = 8000;

// Section-priority classification. Matched case-insensitively at the
// START of the heading (word-boundary anchored, no trailing anchor)
// so compound headings like "Marketing and advertising", "History and
// background", "Early life and career" match cleanly. First matching
// bucket wins. Unmatched headings fall through to LOW. LEAD (before
// first heading) is always included first regardless of priority.
//
// EMPIRICAL CALIBRATION (2026-07-20): the tier assignments below were
// validated against a random sample of 91 Wikipedia articles drawn from
// the museum's own Q-coded agent records (mix: 59 people, 15 companies,
// 17 other). Coverage of common section names ≥5% of the sample:
//   HIGH:   History (24%), Biography (12%), Career (11%), Life (9%),
//           Works (8%), Early life (8%), Life and work (5%), Later
//           life (5% — technically MEDIUM via /^later\b/), Early life
//           and education (4%)
//   MEDIUM: Legacy (12%), Death (5% — biographical framing;
//           cause/place-of-death ties into legacy)
//   SKIP:   References (93%), External links (77%), See also (35%),
//           Further reading (29%), Notes (26%), Publications (12%),
//           Sources (12%), Personal life (12%), Bibliography (11%),
//           Gallery (5%), Footnotes (4%), Family (3%)
// LOW is the default fallthrough for subject-specific sections like
// "Diesel locomotives", "Governance", "Premises" that appear only in
// specialised subject types.
const HIGH_PRIORITY_RE = [
  /^(early|origins?|founding|beginnings?)\b/i,
  /^(history|background)\b/i,
  /^(biography|life)\b/i,
  /^(development|growth|expansion|rise)\b/i,
  /^(career|education|training|research)\b/i,
  /^work\b/i,
  /^(founder|founding)\b/i
];
const MEDIUM_PRIORITY_RE = [
  /^(marketing|advertising|brand|reputation)\b/i,
  /^(products?|portfolio|services?)\b/i,
  /^(today|modern|current|recent)\b/i,
  /^(21st|20th)\b/i,
  /^(operations|activities|business)\b/i,
  /^(legacy|influence|significance|impact)\b/i,
  /^later\b/i,
  // "Death", "Death and legacy" — biographical framing for people
  // subjects, appears in 8% of people articles in the sample.
  /^death\b/i
];
// Explicitly dropped regardless of budget. Wikipedia's "Extracts"
// extension already strips References/External-links/See-also from
// the plaintext body, but the trailing headings often still appear;
// this list is defence-in-depth plus categories we always want to
// drop even when budget would allow them.
const SKIP_RE = [
  /^(references|notes|sources|bibliography|footnotes|citations)\b/i,
  /^(see also|external links|further reading)\b/i,
  /^(gallery|images|photographs)\b/i,
  /^(filmography|discography|publications|selected works|awards|honou?rs)\b/i,
  /^(in (popular )?culture|in fiction|in media)\b/i,
  /^(personal life|family|relationships)\b/i,
  // Tourism trivia — "X's Seat", "X's House", plaques + memorials
  /^([a-z']+ (seat|house|memorial|plaque|statue|birthplace))\b/i,
  /^(controversy|controversies|scandal)\b/i,
  /^(product quality)\b/i
];

async function fetchWikipediaSummary (opts) {
  opts = opts || {};
  const qCode = opts.qCode || null;
  const subjectName = opts.subjectName || null;
  const fetchImpl = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return null;

  // Prefer the sitelink path when we have a Q code — deterministic
  // title resolution beats the search API's best-match guess for
  // ambiguous names.
  let title = null;
  if (qCode) {
    try {
      title = await titleFromWikidataSitelink(qCode, fetchImpl);
    } catch (err) {
      // Fall through to name search.
    }
  }
  if (!title && subjectName) {
    try {
      title = await titleFromSearch(subjectName, fetchImpl);
    } catch (err) {
      return null;
    }
  }
  if (!title) return null;

  try {
    const rawExtract = await fetchIntro(title, fetchImpl);
    if (!rawExtract) return null;
    return {
      title,
      url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/\s+/g, '_')),
      extract: assembleWithBudget(rawExtract, EXTRACT_MAX_CHARS)
    };
  } catch (err) {
    return null;
  }
}

async function titleFromWikidataSitelink (qCode, fetchImpl) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: qCode,
    props: 'sitelinks',
    sitefilter: 'enwiki',
    format: 'json'
  });
  const json = await httpGetJson(WIKIDATA_API + '?' + params.toString(), fetchImpl);
  const entity = json && json.entities && json.entities[qCode];
  const sitelink = entity && entity.sitelinks && entity.sitelinks.enwiki;
  return (sitelink && sitelink.title) || null;
}

async function titleFromSearch (subjectName, fetchImpl) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: subjectName,
    srlimit: '1',
    format: 'json',
    origin: '*'
  });
  const json = await httpGetJson(WIKI_API + '?' + params.toString(), fetchImpl);
  const first = json && json.query && json.query.search && json.query.search[0];
  return (first && first.title) || null;
}

async function fetchIntro (title, fetchImpl) {
  // No exintro / no exsentences — MediaWiki's Extracts extension
  // returns the FULL article plaintext (references + tables stripped);
  // assembleWithBudget below then parses sections and keeps only the
  // priority ones up to EXTRACT_MAX_CHARS. Fetching the full article
  // is cheap; the article body sits in the API response we already
  // pay for. The cost lever is what we forward to the writer, not
  // what we fetch.
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    // exsectionformat=plain emits section headings as short standalone
    // lines ("Origins", "Development") rather than the default wiki
    // syntax ("=== Origins ===", "== Development =="). Section-priority
    // matching below relies on the plain form.
    exsectionformat: 'plain',
    titles: title,
    format: 'json',
    origin: '*'
  });
  const json = await httpGetJson(WIKI_API + '?' + params.toString(), fetchImpl);
  const pages = (json && json.query && json.query.pages) || {};
  const pageId = Object.keys(pages)[0];
  const page = pageId ? pages[pageId] : null;
  return (page && page.extract) || null;
}

// Split a MediaWiki plaintext extract into { heading, body } sections.
// Wikipedia's `exsectionformat=plain` emits section headings as short
// standalone lines, but the surrounding whitespace is inconsistent —
// some articles put a blank line between heading and body (double
// newline), others use a single newline. Parsing on line boundaries
// handles both. LEAD content (before the first heading) is emitted
// with heading === '' so it can be force-included by
// assembleWithBudget.
function parseSections (rawText) {
  const lines = String(rawText || '').split('\n');
  const sections = [];
  let heading = ''; // LEAD
  let bodyLines = [];
  const flush = function () {
    const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (body) sections.push({ heading, body });
    bodyLines = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      bodyLines.push('');
      continue;
    }
    if (looksLikeHeading(line)) {
      // Heading only fires when the previous line is blank (or the
      // line is first in the text) AND there's at least one non-empty
      // line after it (i.e. body follows). Guards against treating an
      // in-paragraph short line as a false heading.
      const prevBlank = (i === 0) || !lines[i - 1].trim();
      let hasFollowingBody = false;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j].trim()) { hasFollowingBody = true; break; }
      }
      if (prevBlank && hasFollowingBody) {
        flush();
        heading = line;
        continue;
      }
    }
    bodyLines.push(line);
  }
  flush();
  return sections;
}

function looksLikeHeading (line) {
  if (!line || line.length > 60) return false;
  // Sentence-ending punctuation → prose, not a heading.
  if (/[.!?…]$/.test(line)) return false;
  // Colon at end → probably a list intro like "Notable works:", not a
  // section heading.
  if (/:$/.test(line)) return false;
  return true;
}

function priorityOf (heading) {
  if (heading === '') return 0; // LEAD — always first
  const h = heading.trim();
  if (SKIP_RE.some(function (re) { return re.test(h); })) return 99;
  if (HIGH_PRIORITY_RE.some(function (re) { return re.test(h); })) return 1;
  if (MEDIUM_PRIORITY_RE.some(function (re) { return re.test(h); })) return 2;
  return 3; // LOW — subsections, uncategorised
}

// Assemble a budget-capped extract: LEAD first, then sections sorted
// by priority; drop SKIP sections regardless of budget; truncate the
// last kept section only if we can fit >= 100 chars of it (avoids
// trailing stub headings that carry no body).
function assembleWithBudget (rawText, maxChars) {
  const sections = parseSections(rawText);
  if (sections.length === 0) return truncate(rawText || '', maxChars);

  // Preserve original order within same priority — Wikipedia's
  // History-before-Marketing-before-Today ordering is meaningful.
  const indexed = sections.map(function (s, i) {
    return { section: s, order: i, priority: priorityOf(s.heading) };
  }).filter(function (x) { return x.priority !== 99; });
  indexed.sort(function (a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.order - b.order;
  });

  const parts = [];
  let used = 0;
  const SEP = '\n\n';
  const MIN_TRUNCATED = 100;
  for (const entry of indexed) {
    const heading = entry.section.heading;
    const body = entry.section.body;
    const rendered = heading ? heading + SEP + body : body;
    const withSep = (parts.length ? SEP : '') + rendered;
    if (used + withSep.length <= maxChars) {
      parts.push(rendered);
      used += withSep.length;
      continue;
    }
    const remaining = maxChars - used - (parts.length ? SEP.length : 0);
    if (remaining >= MIN_TRUNCATED) {
      parts.push(rendered.slice(0, remaining));
      used = maxChars;
    }
    break;
  }
  return parts.join(SEP);
}

async function httpGetJson (url, fetchImpl) {
  const opts = { headers: { 'User-Agent': USER_AGENT } };
  let timer = null;
  if (typeof AbortController === 'function') {
    const controller = new AbortController();
    opts.signal = controller.signal;
    timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  }
  try {
    const res = await fetchImpl(url, opts);
    if (!res || !res.ok) return null;
    return await res.json();
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

function truncate (str, maxChars) {
  if (!str || str.length <= maxChars) return str;
  // Trim at the end of the previous sentence if we can find one — a
  // clean cut reads better in the prompt than mid-sentence truncation.
  const clipped = str.slice(0, maxChars);
  const lastPeriod = clipped.lastIndexOf('. ');
  if (lastPeriod > maxChars * 0.6) return clipped.slice(0, lastPeriod + 1);
  return clipped + '…';
}

// Wikidata properties that signal a founder/parent/succession relationship.
// When any of these are present on a subject, Wikipedia is likely to be the
// only source that discusses the modern successor's rebrand / distancing
// from the founder's views (see anti-patterns.md § Modern-successor
// distancing). Override adaptive suppression when we see any of these,
// even if museum + Wikidata otherwise look rich enough.
//
//   P800  notable work                (person → org they founded/produced)
//   P749  parent organization         (org → its modern owner)
//   P127  owned by                    (org → its modern owner)
//   P1830 owner of                    (org → its subsidiaries)
//   P355  subsidiary                  (org → children)
//   P155  replaces                    (rebrand chain — see note below)
//   P156  replaced by                 (rebrand chain — see note below)
//
// P155/P156 are the strongest direct signal for a rebrand but are NOT
// currently in CLAIM_PROPS (fetch-wikidata-live.js). Left listed for the
// day they are — the override check is defensively broad. Adding them
// to CLAIM_PROPS is tracked separately.
//
// Deliberately NOT included: P112 (founded by). Every incorporated
// entity has a founder — including it here would fire the override
// on essentially every organisation, defeating the point of adaptive
// suppression.
const SUCCESSOR_SIGNAL_PROPS = ['P800', 'P749', 'P127', 'P1830', 'P355', 'P155', 'P156'];

function hasSuccessorSignal (wikidataContext) {
  if (!wikidataContext || typeof wikidataContext !== 'object') return null;
  for (const p of SUCCESSOR_SIGNAL_PROPS) {
    if (wikidataContext[p] != null) return p;
  }
  return null;
}

// Decide whether to fire Wikipedia for a subject, given the config flags
// and the sources already gathered. Both call sites (regenerate-biography
// and routes/ai-biography) use this so the gate stays consistent.
//
// Returns { fire: boolean, reason: string } — `reason` is diagnostic, safe
// to log. Contract:
//   - master flag off              → { fire: false, reason: 'flag_off' }
//   - master flag on + adaptive off → { fire: true,  reason: 'flag_on_adaptive_disabled' }
//   - master flag on + adaptive on:
//       - Wikidata has a founder/parent/succession signal → { fire: true,
//         reason: 'forced_by_successor_signal:<P###>' } (added 2026-08 to
//         catch modern-successor rebrand/distancing stories that only
//         Wikipedia's article body contains — MSI Reproductive Choices
//         being the canonical case). Overrides suppression by rich
//         museum text or Wikidata claim count.
//       - either gate is at-or-above threshold → { fire: false, reason: 'gated_by_<X>' }
//       - both gates below threshold           → { fire: true,  reason: 'adaptive_thin_sources' }
function shouldFetchWikipedia (config, personData, wikidataContext) {
  if (!config || config.aiBiographyWikipediaEnabled !== true) {
    return { fire: false, reason: 'flag_off' };
  }
  if (config.aiBiographyWikipediaAdaptiveDisabled === true) {
    return { fire: true, reason: 'flag_on_adaptive_disabled' };
  }

  // Successor-signal override, checked BEFORE the adaptive suppression
  // gates. Subjects with a founder/parent/subsidiary/succession claim
  // in Wikidata are the exact population where the modern-successor
  // distancing rule can bite — we NEED Wikipedia's article body for
  // the writer to cite the rebrand/repudiation.
  const successorProp = hasSuccessorSignal(wikidataContext);
  if (successorProp) {
    return { fire: true, reason: 'forced_by_successor_signal:' + successorProp };
  }

  const minWikidataClaims = Number.isInteger(config.aiBiographyWikipediaAdaptiveMinWikidataClaims)
    ? config.aiBiographyWikipediaAdaptiveMinWikidataClaims
    : 8;
  const minMuseumChars = Number.isInteger(config.aiBiographyWikipediaAdaptiveMinMuseumChars)
    ? config.aiBiographyWikipediaAdaptiveMinMuseumChars
    : 500;

  // Wikidata claim count — how many CLAIM_PROPS resolved to values. The
  // fetcher dual-keys entries under P-code + human label, so we count
  // only the P-code keys to avoid double-counting.
  const wdClaimCount = wikidataContext
    ? Object.keys(wikidataContext).filter(function (k) { return /^P\d+$/.test(k); }).length
    : 0;
  if (wdClaimCount >= minWikidataClaims) {
    return { fire: false, reason: 'gated_by_wikidata_claims:' + wdClaimCount };
  }

  const museumChars =
    ((personData && personData.biography) ? String(personData.biography).length : 0) +
    ((personData && personData.briefBiography) ? String(personData.briefBiography).length : 0);
  if (museumChars >= minMuseumChars) {
    return { fire: false, reason: 'gated_by_museum_chars:' + museumChars };
  }

  return { fire: true, reason: 'adaptive_thin_sources' };
}

module.exports = fetchWikipediaSummary;
module.exports.shouldFetchWikipedia = shouldFetchWikipedia;
module.exports.SUCCESSOR_SIGNAL_PROPS = SUCCESSOR_SIGNAL_PROPS;
module.exports.hasSuccessorSignal = hasSuccessorSignal;
// Exposed for tests + tuning experiments — parseSections + priorityOf
// + assembleWithBudget are pure functions worth calibrating against
// real Wikipedia articles rather than only via the network path.
module.exports.parseSections = parseSections;
module.exports.priorityOf = priorityOf;
module.exports.assembleWithBudget = assembleWithBudget;
module.exports.EXTRACT_MAX_CHARS = EXTRACT_MAX_CHARS;

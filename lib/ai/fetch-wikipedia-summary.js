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
 * `extract` is plain text (no wiki markup), truncated to the first
 * ~2000 chars — enough for era/context but not the full article.
 */

const USER_AGENT = 'collectionsonline-ai-biographies (contact@sciencemuseumgroup.org.uk)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const REQUEST_TIMEOUT_MS = 8000;
const EXTRACT_MAX_CHARS = 2000;
const INTRO_SENTENCES = 12;

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
    const extract = await fetchIntro(title, fetchImpl);
    if (!extract) return null;
    return {
      title,
      url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/\s+/g, '_')),
      extract: truncate(extract, EXTRACT_MAX_CHARS)
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
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exsentences: String(INTRO_SENTENCES),
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

// Decide whether to fire Wikipedia for a subject, given the config flags
// and the sources already gathered. Both call sites (regenerate-biography
// and routes/ai-biography) use this so the gate stays consistent.
//
// Returns { fire: boolean, reason: string } — `reason` is diagnostic, safe
// to log. Contract:
//   - master flag off              → { fire: false, reason: 'flag_off' }
//   - master flag on + adaptive off → { fire: true,  reason: 'flag_on_adaptive_disabled' }
//   - master flag on + adaptive on:
//       - either gate is at-or-above threshold → { fire: false, reason: 'gated_by_<X>' }
//       - both gates below threshold           → { fire: true,  reason: 'adaptive_thin_sources' }
function shouldFetchWikipedia (config, personData, wikidataContext) {
  if (!config || config.aiBiographyWikipediaEnabled !== true) {
    return { fire: false, reason: 'flag_off' };
  }
  if (config.aiBiographyWikipediaAdaptiveDisabled === true) {
    return { fire: true, reason: 'flag_on_adaptive_disabled' };
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

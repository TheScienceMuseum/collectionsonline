'use strict';

/**
 * Fetch a Grace's Guide article intro for use as INPUT to the writer.
 *
 * Grace's Guide (gracesguide.co.uk) is a MediaWiki-based public wiki
 * covering UK industrial history — engineers, engineering firms,
 * railways, manufacturers, ceramics, mines. Well-matched to the SMG
 * collection's transport / Victorian-industry weight. Free, no API
 * key required.
 *
 * Gated on Wikidata property P3074 (Grace's Guide ID). No P3074
 * means the subject doesn't have a Grace's Guide article — skip
 * without fetching. The P3074 value IS the article title, so no
 * search step is needed.
 *
 * Master flag `aiBiographyGracesGuideEnabled` (default true) can
 * kill the adapter without a code change. When off, no HTTP calls
 * fire.
 *
 * Returns { title, url, extract } or null. `extract` is plain text
 * (no wiki markup), truncated to ~2000 chars — enough for the intro
 * paragraphs used as writer context, not the full article.
 */

const USER_AGENT = 'collectionsonline-ai-biographies (contact@sciencemuseumgroup.org.uk)';
const GRACES_API = 'https://www.gracesguide.co.uk/api.php';
const REQUEST_TIMEOUT_MS = 8000;
const EXTRACT_MAX_CHARS = 2000;
const INTRO_SENTENCES = 12;

async function fetchGracesGuideSummary (opts) {
  opts = opts || {};
  const config = opts.config || {};
  if (config.aiBiographyGracesGuideEnabled === false) return null;

  // Article title lives directly in Wikidata property P3074. Post-
  // 2026-07-10 fetcher shape: { value, claims: [{ value, qCode? }] }.
  // Legacy shape: string. Support both.
  const title = extractGracesGuideTitleFromWikidata(opts.wikidataContext);
  if (!title) return null;

  const fetchImpl = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return null;

  try {
    const extract = await fetchIntro(title, fetchImpl);
    if (!extract) return null;
    return {
      title,
      url: 'https://www.gracesguide.co.uk/' + encodeURIComponent(title.replace(/\s+/g, '_')),
      extract: truncate(extract, EXTRACT_MAX_CHARS)
    };
  } catch (err) {
    return null;
  }
}

function extractGracesGuideTitleFromWikidata (wikidataContext) {
  if (!wikidataContext) return null;
  const entry = wikidataContext.P3074;
  if (!entry) return null;
  if (typeof entry === 'string') return entry.trim() || null;
  if (Array.isArray(entry.claims) && entry.claims.length) {
    const first = entry.claims[0];
    if (first && typeof first.value === 'string' && first.value.trim()) {
      return first.value.trim();
    }
  }
  if (typeof entry.value === 'string' && entry.value.trim()) return entry.value.trim();
  return null;
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
  const url = GRACES_API + '?' + params.toString();
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
    const json = await res.json();
    const pages = (json && json.query && json.query.pages) || {};
    const pageId = Object.keys(pages)[0];
    const page = pageId ? pages[pageId] : null;
    return (page && page.extract) || null;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

function truncate (str, maxChars) {
  if (!str || str.length <= maxChars) return str;
  const clipped = str.slice(0, maxChars);
  const lastPeriod = clipped.lastIndexOf('. ');
  if (lastPeriod > maxChars * 0.6) return clipped.slice(0, lastPeriod + 1);
  return clipped + '…';
}

module.exports = fetchGracesGuideSummary;
module.exports.extractGracesGuideTitleFromWikidata = extractGracesGuideTitleFromWikidata;

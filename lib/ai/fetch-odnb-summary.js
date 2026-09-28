'use strict';

/**
 * Fetch an Oxford Dictionary of National Biography (ODNB) article
 * intro for use as INPUT to the writer.
 *
 * ODNB is a subscription-required source; access requires an
 * institutional API key + endpoint URL (typically routed via
 * Athens / Shibboleth or an institutional proxy). The Science
 * Museum Group may have institutional access but the credential
 * isn't in hand yet — this module ships with graceful fallback:
 * if config.aiBiographyOdnbApiUrl OR config.aiBiographyOdnbApiToken
 * is missing, the fetch is skipped and null is returned. Same
 * happens when the master flag `aiBiographyOdnbEnabled` is off.
 *
 * When the credential IS present, the adapter fires only when the
 * subject has a known ODNB entry — signalled by Wikidata property
 * P1415 (Dictionary of National Biography ID). No P1415 → no fetch
 * — avoids spamming the API on subjects who don't have an ODNB
 * article (non-British / non-notable / non-persons).
 *
 * The expected API contract is straightforward JSON:
 *   GET <apiUrl>?id=<odnbId>
 *   Authorization: Bearer <apiToken>
 *   →  200 { "title": "…", "extract": "…", "url": "https://…" }
 *   →  404 (or missing "extract"): returns null
 *
 * When we get real credentials + endpoint, the API-URL config value
 * is what we tweak; the response contract might need minor shape
 * adjustment via a small transform inside `fetchOdnb`. Docs on the
 * institutional access model are still TBD as of 2026-07-10.
 *
 * The `extract` field is truncated to ~2500 chars — ODNB entries
 * can run 5,000-15,000+ characters, and we need the intro / first
 * paragraphs only for input-mode use. Verify-only lookups (a
 * hypothetical future verify-external tool) would fetch the full
 * entry separately.
 */

const REQUEST_TIMEOUT_MS = 8000;
const EXTRACT_MAX_CHARS = 2500;

async function fetchOdnbSummary (opts) {
  opts = opts || {};
  const config = opts.config || {};
  if (config.aiBiographyOdnbEnabled !== true) return null;
  const apiUrl = config.aiBiographyOdnbApiUrl || '';
  const apiToken = config.aiBiographyOdnbApiToken || '';
  if (!apiUrl || !apiToken) return null;

  // Only fire when the subject has a known ODNB entry. Detected via
  // Wikidata's P1415 (Dictionary of National Biography ID) — populated
  // on the wikidataContext by fetchWikidataLive.js as a claims entry.
  // Absent → subject doesn't have an ODNB article, skip.
  const odnbId = extractOdnbIdFromWikidata(opts.wikidataContext);
  if (!odnbId) return null;

  const fetchImpl = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return null;

  try {
    const summary = await fetchOdnb(apiUrl, apiToken, odnbId, fetchImpl);
    if (!summary || !summary.extract) return null;
    return {
      title: summary.title || null,
      url: summary.url || null,
      extract: truncate(summary.extract, EXTRACT_MAX_CHARS)
    };
  } catch (err) {
    return null;
  }
}

function extractOdnbIdFromWikidata (wikidataContext) {
  if (!wikidataContext) return null;
  const entry = wikidataContext.P1415;
  if (!entry) return null;
  if (typeof entry === 'string') return entry.trim() || null;
  // Post-2026-07-10 upgraded shape: { value, claims: [{ value, qCode? }] }
  if (Array.isArray(entry.claims) && entry.claims.length) {
    const first = entry.claims[0];
    if (first && typeof first.value === 'string' && first.value.trim()) {
      return first.value.trim();
    }
  }
  if (typeof entry.value === 'string' && entry.value.trim()) return entry.value.trim();
  return null;
}

async function fetchOdnb (apiUrl, apiToken, odnbId, fetchImpl) {
  const url = apiUrl + (apiUrl.indexOf('?') !== -1 ? '&' : '?') + 'id=' + encodeURIComponent(odnbId);
  const opts = {
    headers: {
      Authorization: 'Bearer ' + apiToken,
      Accept: 'application/json'
    }
  };
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
  const clipped = str.slice(0, maxChars);
  const lastPeriod = clipped.lastIndexOf('. ');
  if (lastPeriod > maxChars * 0.6) return clipped.slice(0, lastPeriod + 1);
  return clipped + '…';
}

module.exports = fetchOdnbSummary;
module.exports.extractOdnbIdFromWikidata = extractOdnbIdFromWikidata;

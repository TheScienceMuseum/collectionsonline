'use strict';

// Wikidata "deep" verification tool. Fetches specific structured
// properties for a subject's Q-code directly from the Wikidata JSON
// API, then compares them against the claim text via containment
// similarity.
//
// Rationale: the writer's input package already includes a shallow
// set of Wikidata properties (see lib/ai/fetch-wikidata-live.js). This
// tool is for verification against Wikidata beyond that shallow load —
// full property fetch, label resolution for Q-code values, and
// containment match against the reviewer's / curator's claim text.
//
// Tier: B (structured, community-curated). Deterministic — no LLM
// required. Cheap; suitable for both curator-triggered on-demand
// verification and (later) batch external verification.
//
// Return shape follows the tool interface in lib/ai/verify-external.js.

const { similarityDetail } = require('../claim-signature');

const NAME = 'wikidataDeep';
const TIER = 'B';
const USER_AGENT = 'collectionsonline-guardrail (contact@sciencemuseum.org.uk)';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const REQUEST_TIMEOUT_MS = 8000;

// Properties considered in a "deep" fetch — union of the shallow-fetch
// set from fetch-wikidata-live.js plus a handful of others that come
// up in verification. Shared with routes/admin-ai.js via
// lib/ai/wikidata-property-labels.js so we don't have to keep two
// parallel property → label maps in sync.
const CLAIM_PROPS = require('../wikidata-property-labels').PROPERTIES;

// Match threshold — a claim is considered "corroborated" by a Wikidata
// property value if the containment ratio is >= 0.5 with at least 2
// tokens overlap. Both dimensions guard against trivial matches.
const MATCH_RATIO_MIN = 0.5;
const MATCH_INTERSECTION_MIN = 2;

async function query (claim, subject, opts) {
  opts = opts || {};
  const fetchImpl = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return { matched: false, error: 'no fetch available' };
  const qCode = subject && subject.wikidataQCode;
  if (!qCode) return { matched: false, error: 'no wikidata Q-code on subject' };
  if (!claim || !String(claim).trim()) return { matched: false, error: 'empty claim' };

  let claims;
  try {
    claims = await fetchClaims(qCode, fetchImpl);
  } catch (err) {
    return { matched: false, error: 'wikidata fetch failed: ' + (err && err.message) };
  }
  if (!claims) return { matched: false, error: 'no entity returned for ' + qCode };

  // Resolve Q-code values on relevant properties to their English labels.
  let resolvedProps;
  try {
    resolvedProps = await resolveLabels(claims, fetchImpl);
  } catch (err) {
    return { matched: false, error: 'label resolution failed: ' + (err && err.message) };
  }

  const matches = findMatches(claim, resolvedProps);
  const bestMatch = matches[0] || null;
  const evidenceUrl = 'https://www.wikidata.org/wiki/' + qCode;

  if (matches.length === 0) {
    return {
      matched: true,
      extracts: [{
        text: 'Wikidata entity ' + qCode + ' has no property value corroborating the claim.',
        url: evidenceUrl,
        supportsClaim: null
      }],
      verdict: 'unclear',
      reasoning: 'no property value on ' + qCode + ' matched the claim',
      cost: 0
    };
  }

  return {
    matched: true,
    extracts: matches.slice(0, 3).map(function (m) {
      return {
        text: m.propertyLabel + ': ' + m.value,
        url: evidenceUrl + '#' + m.propertyId,
        supportsClaim: true
      };
    }),
    verdict: 'supported',
    reasoning: 'claim corroborated by wikidata ' + bestMatch.propertyId + ' (' + bestMatch.propertyLabel + ')',
    cost: 0
  };
}

// --- Wikidata fetch ------------------------------------------------

async function fetchClaims (qCode, fetchImpl) {
  const url = WIKIDATA_API + '?' + new URLSearchParams({
    action: 'wbgetentities',
    ids: qCode,
    languages: 'en',
    props: 'claims',
    format: 'json',
    origin: '*'
  }).toString();
  const json = await httpGetJson(url, fetchImpl);
  const entity = json && json.entities && json.entities[qCode];
  return entity && entity.claims ? entity.claims : null;
}

// For each property we care about, collect its values. Where a value
// is a Q-code reference, resolve to the English label so we can string-
// match against claim text. Returns an array of
// { propertyId, propertyLabel, value } objects.
async function resolveLabels (claims, fetchImpl) {
  const out = [];
  const qCodesToResolve = new Set();

  Object.keys(CLAIM_PROPS).forEach(function (propId) {
    if (!claims[propId]) return;
    claims[propId].forEach(function (statement) {
      const val = statement && statement.mainsnak && statement.mainsnak.datavalue && statement.mainsnak.datavalue.value;
      if (!val) return;
      if (val.id && /^Q\d+$/.test(val.id)) {
        qCodesToResolve.add(val.id);
        out.push({ propertyId: propId, propertyLabel: CLAIM_PROPS[propId], _pendingQCode: val.id });
      } else if (typeof val === 'string') {
        out.push({ propertyId: propId, propertyLabel: CLAIM_PROPS[propId], value: val });
      } else if (val.time) {
        // Time value — trim leading '+' and everything after 'T' for
        // legibility ("+1879-03-14T00:00:00Z" → "1879-03-14").
        const t = String(val.time).replace(/^\+/, '').split('T')[0];
        out.push({ propertyId: propId, propertyLabel: CLAIM_PROPS[propId], value: t });
      }
    });
  });

  if (qCodesToResolve.size === 0) return out.filter(function (p) { return p.value; });

  const labels = await fetchLabels(Array.from(qCodesToResolve), fetchImpl);
  return out.map(function (p) {
    if (p._pendingQCode) {
      p.value = labels[p._pendingQCode] || p._pendingQCode;
      delete p._pendingQCode;
    }
    return p;
  }).filter(function (p) { return p.value; });
}

// Batch-resolve Q-code → English label. Wikidata caps ids per request
// at 50; chunk if needed.
async function fetchLabels (qCodes, fetchImpl) {
  const labels = {};
  for (let i = 0; i < qCodes.length; i += 50) {
    const batch = qCodes.slice(i, i + 50);
    const url = WIKIDATA_API + '?' + new URLSearchParams({
      action: 'wbgetentities',
      ids: batch.join('|'),
      languages: 'en',
      props: 'labels',
      format: 'json',
      origin: '*'
    }).toString();
    const json = await httpGetJson(url, fetchImpl);
    const entities = (json && json.entities) || {};
    Object.keys(entities).forEach(function (id) {
      const label = entities[id] && entities[id].labels && entities[id].labels.en && entities[id].labels.en.value;
      if (label) labels[id] = label;
    });
  }
  return labels;
}

async function httpGetJson (url, fetchImpl) {
  // AbortController timeout only when the runtime supports it. See
  // wikipedia.js for the reasoning.
  const opts = { headers: { 'User-Agent': USER_AGENT } };
  let timer = null;
  if (typeof AbortController === 'function') {
    const controller = new AbortController();
    opts.signal = controller.signal;
    timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  }
  try {
    const res = await fetchImpl(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// --- Matching -----------------------------------------------------

// For each resolved property value, check whether the claim contains
// the value (containment similarity). Returns matches sorted best-first.
function findMatches (claim, resolvedProps) {
  const scored = [];
  resolvedProps.forEach(function (p) {
    if (!p.value) return;
    const detail = similarityDetail(claim, String(p.value));
    if (detail.ratio >= MATCH_RATIO_MIN && detail.intersection >= MATCH_INTERSECTION_MIN) {
      scored.push({
        propertyId: p.propertyId,
        propertyLabel: p.propertyLabel,
        value: p.value,
        ratio: detail.ratio,
        intersection: detail.intersection
      });
    }
  });
  scored.sort(function (a, b) { return b.ratio - a.ratio || b.intersection - a.intersection; });
  return scored;
}

module.exports = {
  name: NAME,
  tier: TIER,
  query
};
module.exports.CLAIM_PROPS = CLAIM_PROPS;

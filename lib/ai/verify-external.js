'use strict';

// External claim-verification orchestrator. General-purpose service —
// takes a claim string + subject context, runs enabled external tools
// in parallel, aggregates their verdicts, returns evidence + a final
// verdict callers can attach to the ledger or surface in the admin UI.
//
// Callable from two UI paths, same code either way:
//   - Sentence-level: verify a hidden llm:general_knowledge sentence
//     against external sources. If supported, promote to
//     llm:validated:<toolName> so it publishes at Level 4.
//   - Review-finding: verify whether the reviewer's concern is valid.
//     Returns evidence the curator uses to accept vs dismiss.
//
// Contract (never throws):
//   { verdict, confidence, evidence[], sourceUrl, reasoning, cost,
//     latencyMs, toolResults[] }
//
// verdict           — 'supported' | 'unsupported' | 'unclear'
// confidence        — 'high' | 'medium' | 'low'
// evidence          — array of { toolName, tier, text, url, supportsClaim, verdict }
// sourceUrl         — the highest-authority supporting source URL, or null
// reasoning         — one-line summary of how the verdict was reached
// cost              — total GBP spend across tools (LLM tokens + external
//                     APIs; only Wikipedia currently has a paid step)
// latencyMs         — wall-clock time from call to return
// toolResults       — raw per-tool results for debugging / audit

const wikipediaTool = require('./external-tools/wikipedia');
const wikidataDeepTool = require('./external-tools/wikidata-deep');
const { signature } = require('./claim-signature');

// Registry of shippable tools. Add new tools here as they land.
// verify-external.js picks which to actually invoke via config.
const REGISTRY = {
  wikipedia: wikipediaTool,
  wikidataDeep: wikidataDeepTool
  // Phase 2 will add: gracesGuide, odnb, viaf, lcnaf, gettyTgn, gettyUlan
};

// Authority tier ordering — higher wins on contradiction. Used when
// aggregating verdicts. A tool without an explicit tier defaults to C.
const TIER_RANK = { A: 3, B: 2, C: 1 };

// Cache TTLs per tool (seconds). Passed to the cache layer at set time.
// TODO Phase 3: split by subject lifecycle (historical vs active) per
// the plan file's dual-axis TTL design.
const DEFAULT_TTLS = {
  wikipedia: 3600, // 1h — article prose changes
  wikidataDeep: 86400 // 24h — structured, stable
};

async function verify (claim, subject, opts) {
  opts = opts || {};
  const t0 = Date.now();

  if (!claim || !String(claim).trim()) {
    return errorResult('empty claim', t0);
  }

  const enabledTools = pickEnabledTools(opts);
  if (enabledTools.length === 0) {
    return errorResult('no external tools enabled', t0);
  }

  // Run tools in parallel — they're all HTTP-bound + independent.
  const results = await Promise.all(enabledTools.map(function (tool) {
    return runToolWithCache(tool, claim, subject, opts).catch(function (err) {
      return { toolName: tool.name, tier: tool.tier || 'C', matched: false, error: err && err.message };
    });
  }));

  const evidence = buildEvidence(results);
  const { verdict, confidence, sourceUrl, reasoning } = aggregate(results);
  const cost = results.reduce(function (sum, r) { return sum + ((r && r.cost) || 0); }, 0);

  return {
    verdict,
    confidence,
    evidence,
    sourceUrl,
    reasoning,
    cost,
    latencyMs: Date.now() - t0,
    toolResults: results
  };
}

// --- Tool selection + cache -----------------------------------------

function pickEnabledTools (opts) {
  const requested = Array.isArray(opts.toolNames) && opts.toolNames.length > 0
    ? opts.toolNames
    : Object.keys(REGISTRY);
  return requested
    .map(function (name) { return REGISTRY[name]; })
    .filter(Boolean);
}

async function runToolWithCache (tool, claim, subject, opts) {
  const cache = opts.cache;
  const cacheKey = tool.name + ':' + (subject && subject.id ? subject.id : 'unknown') + ':' + signature(claim);
  const ttlMs = (DEFAULT_TTLS[tool.name] || 3600) * 1000;

  if (cache && typeof cache.get === 'function' && cache.isReady && cache.isReady()) {
    try {
      const cached = await cache.get({ segment: 'external-verify', id: cacheKey });
      if (cached && cached.item) {
        return Object.assign({}, cached.item, {
          toolName: tool.name,
          tier: tool.tier || 'C',
          cached: true,
          cost: 0 // cached hits are free
        });
      }
    } catch (err) {
      // Cache read failure is non-fatal — proceed to live fetch.
    }
  }

  const raw = await tool.query(claim, subject || {}, opts);
  const result = Object.assign({}, raw, { toolName: tool.name, tier: tool.tier || 'C' });

  if (cache && typeof cache.set === 'function' && cache.isReady && cache.isReady()) {
    try {
      await cache.set({ segment: 'external-verify', id: cacheKey }, result, ttlMs);
    } catch (err) {
      // Cache write failure is non-fatal.
    }
  }

  return result;
}

// --- Aggregation ---------------------------------------------------

function buildEvidence (results) {
  const out = [];
  results.forEach(function (r) {
    if (!r || !r.matched) return;
    (r.extracts || []).forEach(function (ex) {
      out.push({
        toolName: r.toolName,
        tier: r.tier,
        text: ex.text,
        url: ex.url,
        supportsClaim: ex.supportsClaim,
        verdict: r.verdict || null
      });
    });
  });
  return out;
}

// Highest-tier verdict wins on contradiction. Ties: 'supported' >
// 'unsupported' > 'unclear'. Confidence is derived from the number of
// tools that agreed — a single-tool supported is medium; two-or-more
// agreeing tools is high; only 'unclear' or errors is low.
function aggregate (results) {
  const decisive = results.filter(function (r) {
    return r && r.matched && (r.verdict === 'supported' || r.verdict === 'unsupported');
  });
  if (decisive.length === 0) {
    return {
      verdict: 'unclear',
      confidence: 'low',
      sourceUrl: null,
      reasoning: 'no tool returned a decisive verdict'
    };
  }

  decisive.sort(function (a, b) { return (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0); });
  const top = decisive[0];
  const topTier = top.tier;
  const topTierResults = decisive.filter(function (r) { return r.tier === topTier; });

  // Within the top tier: majority verdict. If tied, supported wins
  // (defensive-permissive within the tier).
  const supported = topTierResults.filter(function (r) { return r.verdict === 'supported'; });
  const unsupported = topTierResults.filter(function (r) { return r.verdict === 'unsupported'; });
  const verdict = supported.length >= unsupported.length ? 'supported' : 'unsupported';
  const agreed = verdict === 'supported' ? supported : unsupported;

  // Confidence: high when either (a) two-or-more tools ACROSS ANY tiers
  // agree on this verdict, or (b) a single tier-A source stands alone.
  // Two independent sources agreeing is a stronger signal than the top
  // tier's ranking on its own.
  const agreedAcrossAllTiers = decisive.filter(function (r) { return r.verdict === verdict; });
  const confidence = agreedAcrossAllTiers.length >= 2 || topTier === 'A' ? 'high' : 'medium';

  const firstSupportingUrl = agreed.reduce(function (acc, r) {
    if (acc) return acc;
    const url = (r.extracts || []).map(function (ex) { return ex.url; }).find(Boolean);
    return url || null;
  }, null);

  const reasoning = 'verdict: ' + verdict + ' via tier-' + topTier + ' (' +
    agreed.map(function (r) { return r.toolName; }).join(', ') + ')' +
    (agreed.length !== topTierResults.length
      ? '; ' + (topTierResults.length - agreed.length) + ' other tier-' + topTier + ' tools disagreed'
      : '');

  return {
    verdict,
    confidence,
    sourceUrl: firstSupportingUrl,
    reasoning
  };
}

function errorResult (reason, t0) {
  return {
    verdict: 'unclear',
    confidence: 'low',
    evidence: [],
    sourceUrl: null,
    reasoning: reason,
    cost: 0,
    latencyMs: Date.now() - t0,
    toolResults: []
  };
}

module.exports = verify;
module.exports.REGISTRY = REGISTRY;
module.exports.TIER_RANK = TIER_RANK;
module.exports.DEFAULT_TTLS = DEFAULT_TTLS;
module.exports.aggregate = aggregate;

'use strict';

// Anti-pattern rule-hit instrumentation.
//
// Parses the anti-patterns.md rulebook to extract rule identifiers
// (`## <heading>`), then scans a writer's output (notes + selfReview.skipped
// desiredText + reviewer findings + concern texts) for mentions of each
// rule. Enables the deferred trim pass (task #88) to see which rules
// actually earn their keep in production.
//
// The signal is deliberately loose: any lowercase substring match of a
// rule's keywords in the audit fields counts as a hit. False positives
// are fine (they inflate keep-scores); false negatives would let a rule
// silently coast, which is what we're trying to avoid.
//
// Each rule gets a compact keyword bag derived from the heading:
//   - Full lowercased heading (fuzzy match against verbose prose)
//   - Distinctive words from the heading (short-cut match)
//
// A hit records which fields the rule was cited in — useful because
// notes mentions and skipped-reason mentions are different-strength
// signals (a rule mentioned in `notes` was applied; a rule mentioned in
// `skipped.reason` prevented a fabrication).

const path = require('path');
const fs = require('fs');

const DEFAULT_RULES_PATH = path.join(__dirname, '..', '..', 'prompts', 'biographies', 'anti-patterns.md');

// Words too generic to disambiguate one rule from another. Excluding
// these from the "distinctive keyword" set stops "attribution" from
// matching every rule that happens to mention it.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'vs', 'with',
  'from', 'by', 'as', 'is', 'at', 'be', 'any', 'source', 'tag', 'claim',
  'claims', 'sentence', 'sentences', 'entity', 'entities', 'rule', 'rules'
]);

let CACHED_RULES = null;

function loadRules (rulesPath) {
  const p = rulesPath || DEFAULT_RULES_PATH;
  if (CACHED_RULES && CACHED_RULES.__path === p) return CACHED_RULES;
  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch (err) {
    return { __path: p, rules: [] };
  }
  const rules = [];
  const lines = text.split(/\r?\n/);
  lines.forEach(function (line) {
    // Only capture h2 headings (## …) — h3 subsections are examples
    // inside a rule, not distinct rules.
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) return;
    const heading = m[1].trim();
    if (!heading) return;
    // A rule "slug" — filesystem-safe id derived from the heading.
    const slug = heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    // Distinctive keywords — words in the heading that aren't
    // stopwords, ≥5 chars. Falls back to any non-stopword when the
    // long-word set is empty (some headings are all short words).
    const words = heading
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    let keywords = words.filter(function (w) { return w.length >= 5 && !STOPWORDS.has(w); });
    if (keywords.length === 0) {
      keywords = words.filter(function (w) { return !STOPWORDS.has(w); });
    }
    rules.push({ slug, heading, keywords });
  });
  CACHED_RULES = { __path: p, rules };
  return CACHED_RULES;
}

// Given writer output + reviewer findings, count how many times each
// rule is referenced. Returns:
//   { totalRules: N, hits: [{slug, heading, hitCount, fields}] }
// where `fields` is a Set of field names the rule was seen in
// (`notes`, `skipped`, `checks`, `finding_concern`).
function tallyRuleHits (opts, rulesPath) {
  const { rules } = loadRules(rulesPath);
  const audit = collectAuditText(opts);
  const hits = rules.map(function (rule) {
    let hitCount = 0;
    const fields = new Set();
    // Full-heading substring: strong signal
    Object.keys(audit).forEach(function (fieldName) {
      const haystack = audit[fieldName];
      if (!haystack) return;
      const lower = haystack.toLowerCase();
      const headingLower = rule.heading.toLowerCase();
      if (lower.indexOf(headingLower) !== -1) {
        hitCount += 1;
        fields.add(fieldName);
      }
    });
    // Distinctive-keyword substring: weaker but broader signal
    if (hitCount === 0 && rule.keywords.length >= 2) {
      Object.keys(audit).forEach(function (fieldName) {
        const haystack = audit[fieldName];
        if (!haystack) return;
        const lower = haystack.toLowerCase();
        const kwHits = rule.keywords.filter(function (kw) { return lower.indexOf(kw) !== -1; }).length;
        // Threshold: 2 distinctive keywords for rules with ≤6 keywords,
        // one-third of the keywords otherwise. False positives are
        // cheap (inflate keep-scores); false negatives are what we
        // actually want to avoid — a rule that never registers a hit
        // becomes a retirement candidate.
        const threshold = Math.max(2, Math.ceil(rule.keywords.length / 3));
        if (kwHits >= threshold) {
          hitCount += 1;
          fields.add(fieldName);
        }
      });
    }
    return {
      slug: rule.slug,
      heading: rule.heading,
      hitCount,
      fields: Array.from(fields).sort()
    };
  });
  return {
    totalRules: rules.length,
    hits
  };
}

// Turn the writer + reviewer output into a bag of audit strings keyed
// by their source field. Keeps the tallies attributable so we can
// distinguish "rule was applied" (notes / checks) from "rule prevented
// a fabrication" (skipped) from "reviewer caught missed rule"
// (finding_concern).
function collectAuditText (opts) {
  opts = opts || {};
  const bag = {
    notes: '',
    checks: '',
    skipped: '',
    finding_concern: ''
  };
  if (typeof opts.notes === 'string') bag.notes = opts.notes;
  if (opts.selfReview && typeof opts.selfReview.checks === 'object' && opts.selfReview.checks) {
    bag.checks = Object.values(opts.selfReview.checks).filter(function (v) { return typeof v === 'string'; }).join(' \n ');
  }
  if (opts.selfReview && Array.isArray(opts.selfReview.skipped)) {
    bag.skipped = opts.selfReview.skipped
      .map(function (s) { return (s.desiredText || '') + ' ' + (s.reason || ''); })
      .join(' \n ');
  }
  if (Array.isArray(opts.findings)) {
    bag.finding_concern = opts.findings.map(function (f) { return f.concern || ''; }).join(' \n ');
  }
  return bag;
}

// Aggregate a list of per-subject tallies (from tallyRuleHits) into
// one summary: per-rule total hits + list of subjects that hit it.
// Useful at the end of a bulk-generate run.
function aggregate (perSubjectTallies) {
  const perRule = {};
  perSubjectTallies.forEach(function (entry) {
    if (!entry || !Array.isArray(entry.tally && entry.tally.hits)) return;
    entry.tally.hits.forEach(function (hit) {
      if (hit.hitCount <= 0) return;
      if (!perRule[hit.slug]) {
        perRule[hit.slug] = {
          slug: hit.slug,
          heading: hit.heading,
          totalHits: 0,
          subjects: []
        };
      }
      perRule[hit.slug].totalHits += hit.hitCount;
      if (perRule[hit.slug].subjects.indexOf(entry.id) === -1) {
        perRule[hit.slug].subjects.push(entry.id);
      }
    });
  });
  return Object.values(perRule).sort(function (a, b) { return b.totalHits - a.totalHits; });
}

module.exports = {
  loadRules,
  tallyRuleHits,
  aggregate,
  collectAuditText
};

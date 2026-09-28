'use strict';

// Tests for the anti-pattern rule-hit tally.
//
// The signal is deliberately loose (substring match on lowercased text),
// so tests cover shape + boundary conditions rather than exhaustive
// linguistic accuracy.

const test = require('tape');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ruleHitTally = require('../lib/ai/rule-hit-tally');

function makeFixture (rulesMd) {
  const p = path.join(os.tmpdir(), 'rules-fixture-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + '.md');
  fs.writeFileSync(p, rulesMd, 'utf8');
  return p;
}

// --- rule extraction ---------------------------------------------------

test('loadRules reads h2 headings only, ignores h3 subsections', function (t) {
  const p = makeFixture([
    '## Historical vs modern names',
    'Some prose about the rule.',
    '### Example — Einstein / Swiss Patent Office',
    'Example text.',
    '## Named-place substitution',
    'Another rule.'
  ].join('\n'));
  const { rules } = ruleHitTally.loadRules(p);
  const slugs = rules.map(function (r) { return r.slug; });
  t.deepEqual(slugs, ['historical-vs-modern-names', 'named-place-substitution']);
  t.equal(rules.length, 2, 'h3 subsections not counted');
  t.end();
});

test('loadRules extracts keywords excluding stopwords', function (t) {
  const p = makeFixture('## Attribution to the wrong entity in a related family');
  const { rules } = ruleHitTally.loadRules(p);
  t.equal(rules[0].slug, 'attribution-to-the-wrong-entity-in-a-related-family');
  // "the", "to", "a", "in" are stopwords; "family" is 6 chars, "wrong" 5,
  // "attribution" 11, "entity" 6, "related" 7 — all should be present
  t.ok(rules[0].keywords.includes('attribution'));
  t.ok(rules[0].keywords.includes('related'));
  t.notOk(rules[0].keywords.includes('the'));
  t.notOk(rules[0].keywords.includes('to'));
  t.end();
});

test('loadRules returns empty rules on missing file', function (t) {
  const out = ruleHitTally.loadRules('/definitely/does/not/exist.md');
  t.deepEqual(out.rules, []);
  t.end();
});

// --- hit detection -----------------------------------------------------

test('full-heading substring in notes = 1 hit', function (t) {
  const p = makeFixture('## Named-place substitution');
  const out = ruleHitTally.tallyRuleHits({
    notes: 'Applied the named-place substitution rule for Port Sunlight vs Bromborough Pool.'
  }, p);
  t.equal(out.hits[0].hitCount, 1);
  t.deepEqual(out.hits[0].fields, ['notes']);
  t.end();
});

test('keyword-majority match falls back when full heading absent', function (t) {
  const p = makeFixture('## Historical vs modern institution names');
  const out = ruleHitTally.tallyRuleHits({
    notes: 'The historical institution name is required here, not the modern name.'
  }, p);
  // Full heading not present, but "historical", "institution", "modern",
  // "names" (partial) are — should hit via keyword fallback
  t.ok(out.hits[0].hitCount >= 1, 'keyword-majority hit fires');
  t.end();
});

test('mentions in skipped[] reason count as skipped-field hit', function (t) {
  const p = makeFixture('## Temporal impossibility — cross-check death dates');
  const out = ruleHitTally.tallyRuleHits({
    selfReview: {
      skipped: [
        { desiredText: 'Jurgens co-founded Unilever in 1930', reason: 'temporal impossibility: Jurgens died 1928' }
      ]
    }
  }, p);
  t.ok(out.hits[0].hitCount >= 1);
  t.ok(out.hits[0].fields.includes('skipped'));
  t.end();
});

test('unrelated audit text produces zero hits', function (t) {
  const p = makeFixture([
    '## Historical vs modern names',
    '## Named-place substitution'
  ].join('\n'));
  const out = ruleHitTally.tallyRuleHits({
    notes: 'Wrote a straightforward biography with no editorial concerns.',
    findings: []
  }, p);
  out.hits.forEach(function (h) {
    t.equal(h.hitCount, 0, h.slug + ' should not fire');
  });
  t.end();
});

// --- aggregation ------------------------------------------------------

test('aggregate combines per-subject tallies', function (t) {
  const p = makeFixture([
    '## Historical vs modern names',
    '## Named-place substitution'
  ].join('\n'));
  const tallies = [
    { id: 'cp1', tally: ruleHitTally.tallyRuleHits({ notes: 'named-place substitution applied' }, p) },
    { id: 'cp2', tally: ruleHitTally.tallyRuleHits({ notes: 'named-place substitution here too' }, p) },
    { id: 'cp3', tally: ruleHitTally.tallyRuleHits({ notes: 'no relevant issues' }, p) }
  ];
  const out = ruleHitTally.aggregate(tallies);
  t.equal(out.length, 1, 'only named-place-substitution fired');
  t.equal(out[0].slug, 'named-place-substitution');
  t.equal(out[0].totalHits, 2);
  t.deepEqual(out[0].subjects.sort(), ['cp1', 'cp2']);
  t.end();
});

test('aggregate returns empty when no rules fired', function (t) {
  const p = makeFixture('## Historical vs modern names');
  const tally = ruleHitTally.tallyRuleHits({ notes: 'irrelevant' }, p);
  const out = ruleHitTally.aggregate([{ id: 'cp1', tally }]);
  t.deepEqual(out, []);
  t.end();
});

test('aggregate handles missing / null tallies without crashing', function (t) {
  const out = ruleHitTally.aggregate([
    null,
    { id: 'cp1' },
    { id: 'cp2', tally: null },
    { id: 'cp3', tally: { hits: null } }
  ]);
  t.deepEqual(out, []);
  t.end();
});

// --- integration with the real rulebook -------------------------------

test('loads the real anti-patterns.md and finds >= 8 rules', function (t) {
  // Sanity check the real fixture parses. Doesn't assert an exact count
  // because the rulebook grows over time.
  const out = ruleHitTally.loadRules();
  t.ok(out.rules.length >= 8, 'at least 8 rules in the real anti-patterns.md');
  const slugs = out.rules.map(function (r) { return r.slug; });
  t.ok(slugs.includes('named-place-substitution'), 'named-place-substitution rule present');
  t.end();
});

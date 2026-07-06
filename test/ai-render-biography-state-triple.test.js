'use strict';

// Tests for Task 60: 3-axis state triple + finding gate now uses
// kind+confidence (bug fix) + concern mapping. Focused on the new
// behaviour; the pre-existing render-biography tests continue to
// cover the legacy shape.

const test = require('tape');
const render = require('../lib/ai/render-biography');
const { signature } = require('../lib/ai/claim-signature');
const { computeConcern } = render;

function s (text, source, sourceDetail) {
  return { text, source, sourceDetail: sourceDetail || null, claimSignature: signature(text) };
}

// --- computeConcern -------------------------------------------------

test('computeConcern: null finding → null concern', function (t) {
  t.equal(computeConcern(null), null);
  t.equal(computeConcern(undefined), null);
  t.end();
});

test('computeConcern: info-kind (any confidence) → info concern', function (t) {
  t.equal(computeConcern({ kind: 'info', confidence: 'high' }), 'info');
  t.equal(computeConcern({ kind: 'info', confidence: 'medium' }), 'info');
  t.equal(computeConcern({ kind: 'info', confidence: 'low' }), 'info');
  t.end();
});

test('computeConcern: error:high → block', function (t) {
  t.equal(computeConcern({ kind: 'error', confidence: 'high' }), 'block');
  t.end();
});

test('computeConcern: error:medium → warning', function (t) {
  t.equal(computeConcern({ kind: 'error', confidence: 'medium' }), 'warning');
  t.end();
});

test('computeConcern: error:low → info (collapsed with info-tier)', function (t) {
  t.equal(computeConcern({ kind: 'error', confidence: 'low' }), 'info');
  t.end();
});

// --- state triple on sentence data ---------------------------------

test('state triple: clean auto-publish → { true, auto, null }', function (t) {
  const bio = { sentences: [s('Museum fact.', 'museum')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  const st = r.sentences[0].state;
  t.deepEqual(st, { visible: true, decidedBy: 'auto', concern: null });
  t.end();
});

test('state triple: auto-hidden by publishing level → { false, auto, null }', function (t) {
  const bio = { sentences: [s('LLM training-data fact.', 'llm:general_knowledge')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  const st = r.sentences[0].state;
  t.deepEqual(st, { visible: false, decidedBy: 'auto', concern: null });
  t.end();
});

test('state triple: curator-approved → { true, curator, null }', function (t) {
  const sent = s('LLM training-data fact.', 'llm:general_knowledge');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const decisions = { approvals: [{ claimSignature: sent.claimSignature }] };
  const r = render(bio, { publishingLevel: 3, decisions });
  t.deepEqual(r.sentences[0].state, { visible: true, decidedBy: 'curator', concern: null });
  t.end();
});

test('state triple: curator-rejected → { false, curator, null }', function (t) {
  const sent = s('Museum fact.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const decisions = { rejections: [{ claimSignature: sent.claimSignature }] };
  const r = render(bio, { publishingLevel: 3, decisions });
  t.deepEqual(r.sentences[0].state, { visible: false, decidedBy: 'curator', concern: null });
  t.end();
});

test('state triple: auto-publish + info-tier finding → { true, auto, info }', function (t) {
  const sent = s('Museum fact.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const openFindings = [{ claimSignature: sent.claimSignature, kind: 'info', confidence: 'medium' }];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.deepEqual(r.sentences[0].state, { visible: true, decidedBy: 'auto', concern: 'info' });
  t.end();
});

test('state triple: auto-publish + error:medium → { true, auto, warning }', function (t) {
  const sent = s('Museum fact.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const openFindings = [{ claimSignature: sent.claimSignature, kind: 'error', confidence: 'medium' }];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.deepEqual(r.sentences[0].state, { visible: true, decidedBy: 'auto', concern: 'warning' });
  t.end();
});

test('state triple: error:high finding auto-hides → { false, auto, block }', function (t) {
  const sent = s('Suspect claim.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const openFindings = [{ claimSignature: sent.claimSignature, kind: 'error', confidence: 'high' }];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.deepEqual(r.sentences[0].state, { visible: false, decidedBy: 'auto', concern: 'block' });
  t.end();
});

test('state triple: curator approval overrides error:high → { true, curator, block }', function (t) {
  // Concern axis remains — the reviewer's block-tier concern is still
  // real. decidedBy flips to 'curator' because the curator explicitly
  // overrode. Both signals visible for audit.
  const sent = s('Suspect claim.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const decisions = { approvals: [{ claimSignature: sent.claimSignature }] };
  const openFindings = [{ claimSignature: sent.claimSignature, kind: 'error', confidence: 'high' }];
  const r = render(bio, { publishingLevel: 3, decisions, openFindings });
  t.deepEqual(r.sentences[0].state, { visible: true, decidedBy: 'curator', concern: 'block' });
  t.end();
});

// --- Bug fix: dismiss no longer un-hides ---------------------------

test('bug fix: RESOLVED error:high finding still hides sentence', function (t) {
  // Regression guard: before Task 60, dismissing an error:high finding
  // removed it from the openFindings input, so render's hide-gate
  // didn't apply — sentence would accidentally publish. Now the
  // finding-gate uses kind+confidence, ignoring resolution status.
  // The only way to un-hide a claim under an error:high concern is
  // an explicit curator approval.
  const sent = s('Suspect claim.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const findings = [{
    claimSignature: sent.claimSignature,
    kind: 'error',
    confidence: 'high',
    resolution: 'dismissed', // <-- key: NOT pending
    resolvedBy: 'test-curator'
  }];
  const r = render(bio, { publishingLevel: 3, openFindings: findings });
  t.equal(r.sentences[0].visible, false, 'dismissed error:high still hides');
  t.equal(r.sentences[0].state.concern, 'block', 'concern still reflects the reviewer flag');
  t.end();
});

test('bug fix: ACCEPTED error:high finding still hides', function (t) {
  // Same guard for 'accepted' resolution.
  const sent = s('Suspect claim.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const findings = [{
    claimSignature: sent.claimSignature,
    kind: 'error',
    confidence: 'high',
    resolution: 'accepted'
  }];
  const r = render(bio, { publishingLevel: 3, openFindings: findings });
  t.equal(r.sentences[0].visible, false);
  t.end();
});

test('bug fix: CLARIFIED error:high finding still hides', function (t) {
  const sent = s('Suspect claim.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const findings = [{
    claimSignature: sent.claimSignature,
    kind: 'error',
    confidence: 'high',
    resolution: 'clarified'
  }];
  const r = render(bio, { publishingLevel: 3, openFindings: findings });
  t.equal(r.sentences[0].visible, false);
  t.end();
});

test('bug fix: resolved info finding does NOT block sentence', function (t) {
  // Info findings never blocked in the first place; resolution status
  // is irrelevant to their gating behaviour.
  const sent = s('Museum fact.', 'museum');
  const bio = { sentences: [sent], paragraphBreaks: [] };
  const findings = [{
    claimSignature: sent.claimSignature,
    kind: 'info',
    confidence: 'medium',
    resolution: 'dismissed'
  }];
  const r = render(bio, { publishingLevel: 3, openFindings: findings });
  t.equal(r.sentences[0].visible, true, 'info never blocked, publishes');
  t.equal(r.sentences[0].state.concern, 'info', 'concern still surfaces the reviewer flag');
  t.end();
});

// --- sourceDetailFormatted (moved from route to render) ------------

test('sourceDetailFormatted: writer emitted a bare wikidata P-code', function (t) {
  const bio = { sentences: [s('Fact.', 'wikidata', 'wikidata:p106')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailFormatted, 'wikidata:P106 (occupation)');
  t.end();
});

test('sourceDetailFormatted: writer already emitted the label', function (t) {
  // Idempotent — passes through unchanged.
  const bio = { sentences: [s('Fact.', 'wikidata', 'wikidata:P69 (educated at)')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailFormatted, 'wikidata:P69 (educated at)');
  t.end();
});

test('sourceDetailFormatted: non-wikidata citations untouched', function (t) {
  const bio = { sentences: [s('Fact.', 'museum', 'relatedItem:co12345')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailFormatted, 'relatedItem:co12345');
  t.end();
});

// --- Task 61: sourceDetailShort strips redundant source prefix ------

test('sourceDetailShort: strips redundant wikidata: prefix on wikidata sentence', function (t) {
  const bio = { sentences: [s('Fact.', 'wikidata', 'wikidata:p106')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailShort, 'P106 (occupation)');
  t.equal(r.sentences[0].sourceDetailFormatted, 'wikidata:P106 (occupation)', 'formatted variant unchanged');
  t.end();
});

test('sourceDetailShort: strips prefix from every wikidata piece in compound', function (t) {
  const bio = { sentences: [s('Fact.', 'wikidata', 'wikidata:p106, wikidata:p108')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailShort, 'P106 (occupation), P108 (employer)');
  t.end();
});

test('sourceDetailShort: mixed sources keeps non-matching pieces intact', function (t) {
  const bio = { sentences: [s('Fact.', 'wikidata', 'wikidata:p106, existingbiography')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailShort, 'P106 (occupation), existingbiography');
  t.end();
});

test('sourceDetailShort: strips relatedItem citations entirely (Task 62)', function (t) {
  // Object chips below the pill already carry item title + link;
  // repeating `relatedItem:coXXX` in the pill is redundant.
  const bio = { sentences: [s('Fact.', 'museum', 'relatedItem:co12345')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailShort, '', 'all pieces stripped → empty string');
  t.equal(r.sentences[0].sourceDetailFormatted, 'relatedItem:co12345', 'full formatted variant unchanged');
  t.end();
});

test('sourceDetailShort: mixed museum sources — keeps non-relatedItem pieces', function (t) {
  const bio = { sentences: [s('Fact.', 'museum', 'personData.birthDate, relatedItem:co12345')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailShort, 'personData.birthDate', 'relatedItem stripped, personData kept');
  t.end();
});

test('sourceDetailShort: multiple relatedItems + one personData → just personData', function (t) {
  const bio = { sentences: [s('Fact.', 'museum', 'relatedItem:co1, relatedItem:co2, personData.name')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailShort, 'personData.name');
  t.end();
});

test('sourceDetailShort: case-insensitive on the prefix match', function (t) {
  const bio = { sentences: [s('Fact.', 'wikidata', 'Wikidata:P106')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].sourceDetailShort, 'P106 (occupation)');
  t.end();
});

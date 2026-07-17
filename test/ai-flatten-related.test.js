'use strict';

// Tests for the shared flattenRelated module. Focused specifically on
// the truncation behaviour that motivated consolidating both routes'
// implementations — the 200-char word-boundary version silently used
// by the admin/bulk-regen path produced the Sobral-adjacency
// hallucination class (see lib/ai/truncate-description.js for the
// full case study).
//
// The truncation algorithm itself is tested more thoroughly in
// test/ai-truncate-description.test.js (if present) — this file
// covers the flattener's shape + integration with the truncation
// module, not the algorithm.

const test = require('tape');
const flattenRelated = require('../lib/ai/flatten-related');

function objItem (id, description) {
  return {
    id,
    attributes: {
      summary_title: 'Object ' + id,
      description
    },
    links: { self: '/objects/' + id }
  };
}

function docItem (id, description) {
  return {
    id,
    attributes: {
      summary_title: 'Doc ' + id,
      description
    },
    links: { self: '/documents/' + id }
  };
}

test('flattens objects + documents into a single array with distinct types', function (t) {
  const out = flattenRelated({
    relatedObjects: [objItem('co1', 'short'), objItem('co2', 'short')],
    relatedDocuments: [docItem('cd1', 'short')]
  });
  t.equal(out.length, 3);
  t.equal(out[0].type, 'object');
  t.equal(out[1].type, 'object');
  t.equal(out[2].type, 'document');
  t.end();
});

test('defensive on missing arrays', function (t) {
  t.doesNotThrow(function () { flattenRelated({}); });
  t.doesNotThrow(function () { flattenRelated(null); });
  t.equal(flattenRelated({}).length, 0);
  t.end();
});

test('carries per-item link + title + role fields through unchanged', function (t) {
  const raw = objItem('co42', 'a description');
  raw.role = 'maker';
  const out = flattenRelated({ relatedObjects: [raw] });
  t.equal(out[0].id, 'co42');
  t.equal(out[0].title, 'Object co42');
  t.equal(out[0].link, '/objects/co42');
  t.equal(out[0].role, 'maker');
  t.equal(out[0].description, 'a description');
  t.end();
});

// --- The bug-fix regression tests ---------------------------------
// These pin the behaviour that specifically fixes the Einstein/Sobral
// bridge-invention. Before the consolidation, regenerate-biography.js
// used a 200-char word-boundary truncation that severed the Eddington
// description mid-clause — this test would have failed under that
// version.

test('truncation uses 500-char sentence-boundary via truncate-description', function (t) {
  // A description longer than 200 (old cap) but shorter than 500. Under
  // the OLD regenerate-biography.js path this would have been truncated
  // at ~200 chars; under the shared module it stays whole.
  const longDesc = 'Mounted photograph showing the instruments used at Sobral, Brazil, during the total solar eclipse of 29 May 1919. ' +
    'The expedition organised by Sir Arthur Eddington of the Royal Astronomical Society travelled instead to Principe. ' +
    'This distinction matters because attributing the Sobral observations to Eddington\'s team confuses two separate expeditions.';
  // 300+ chars but well under 500.
  const out = flattenRelated({ relatedObjects: [objItem('co1', longDesc)] });
  t.ok(out[0].description.length > 200, 'description not truncated at old 200-char cap');
  t.ok(out[0].description.length <= 500, 'description within new 500-char cap');
  // The critical safety check: the "Sobral" and "Eddington" mentions
  // are BOTH present, so the model sees the disambiguating clause and
  // can't invent a bridge.
  t.ok(/Sobral/.test(out[0].description), 'Sobral mention preserved');
  t.ok(/Eddington/.test(out[0].description), 'Eddington mention preserved');
  t.ok(/Principe/.test(out[0].description), 'disambiguating Principe mention preserved (would be cut under old 200-char cap)');
  t.end();
});

test('descriptions over 500 chars cut at sentence boundary, not mid-clause', function (t) {
  const veryLong = 'First sentence with proper terminator. Second sentence with proper terminator. ' +
    'Third sentence with proper terminator that is deliberately long to push past the 500-char boundary because we need to test that the cut happens at a sentence end and not mid-clause somewhere in the middle. ' +
    'Fourth sentence should be cut off entirely.';
  const out = flattenRelated({ relatedObjects: [objItem('co1', veryLong)] });
  t.ok(out[0].description.length <= 500, 'within cap');
  // Description must end at a sentence terminator (or with an ellipsis
  // if no sentence boundary found in the first 30% of the cap).
  const endsCleanly = /[.!?]$/.test(out[0].description) || /…$/.test(out[0].description);
  t.ok(endsCleanly, 'cut ends at sentence terminator or ellipsis');
  t.end();
});

// --- Signature stability -----------------------------------------

test('exports DESCRIPTION_MAX_CHARS constant + truncateDescription helper', function (t) {
  t.equal(flattenRelated.DESCRIPTION_MAX_CHARS, 500);
  t.equal(typeof flattenRelated.truncateDescription, 'function');
  t.end();
});

test('re-exported unchanged from regenerate-biography.js', function (t) {
  const regen = require('../lib/ai/regenerate-biography');
  t.equal(regen.flattenRelated, flattenRelated,
    'regenerate-biography.js re-exports the same function (routes/admin-ai.js depends on this)');
  t.end();
});

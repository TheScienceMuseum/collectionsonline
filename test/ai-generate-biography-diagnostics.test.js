'use strict';

// Tests for the diagnostics out-param added to lib/ai/generate-biography.js.
//
// Covers:
//   - extractJsonObject returns a discriminated result on each failure mode
//     (text_missing / json_parse_failed / missing_biography_field / success)
//   - the log-line improvement ("Got keys: ..." on missing_biography_field)
//     surfaces the shape mismatch — this is the specific signal that
//     would have caught the v7-picked-by-v1-writer bug at a glance.
//
// The main generateBiography() function goes through the Anthropic SDK,
// which we can't stub cleanly without the SDK's client — so this file
// tests extractJsonObject in isolation (exported for tests) and defers
// end-to-end coverage of the diagnostics population to route-level
// tests.

const test = require('tape');
const generateBiography = require('../lib/ai/generate-biography');
const extractJsonObject = generateBiography.extractJsonObject;

test('extractJsonObject: text_missing on empty input', function (t) {
  const r1 = extractJsonObject('');
  const r2 = extractJsonObject(null);
  const r3 = extractJsonObject(undefined);
  t.equal(r1.failureMode, 'text_missing');
  t.equal(r2.failureMode, 'text_missing');
  t.equal(r3.failureMode, 'text_missing');
  t.notOk(r1.parsed);
  t.end();
});

test('extractJsonObject: happy path with valid biography JSON', function (t) {
  const text = JSON.stringify({ biography: 'A brief life.', confidence: 7 });
  const r = extractJsonObject(text);
  t.notOk(r.failureMode, 'no failureMode');
  t.ok(r.parsed, 'parsed present');
  t.equal(r.parsed.biography, 'A brief life.');
  t.equal(r.parsed.confidence, 7);
  t.end();
});

test('extractJsonObject: happy path with markdown fences', function (t) {
  const text = '```json\n' + JSON.stringify({ biography: 'A fenced life.', confidence: 6 }) + '\n```';
  const r = extractJsonObject(text);
  t.notOk(r.failureMode);
  t.ok(r.parsed);
  t.equal(r.parsed.biography, 'A fenced life.');
  t.end();
});

test('extractJsonObject: happy path with prose wrapper (balanced braces)', function (t) {
  const text = 'Here is the biography:\n' +
    JSON.stringify({ biography: 'A wrapped life.', confidence: 5 }) +
    '\nLet me know if you need more.';
  const r = extractJsonObject(text);
  t.notOk(r.failureMode);
  t.ok(r.parsed);
  t.equal(r.parsed.biography, 'A wrapped life.');
  t.end();
});

test('extractJsonObject: missing_biography_field on v7 source-tagged shape', function (t) {
  // This is the exact bug that lit up cp37054: the writer got a v7
  // source-tagged prompt (auto-selected by the alphabetically-latest
  // prompt loader) and returned {sentences: [...], ...} — no biography
  // field. The diagnostics should name this specifically so admin UI
  // can show what Claude did return.
  const text = JSON.stringify({
    sentences: [
      { text: 'Foo.', source: 'museum' },
      { text: 'Bar.', source: 'wikidata' }
    ],
    paragraphBreaks: [0],
    confidence: 7,
    notes: 'Ok'
  });
  const r = extractJsonObject(text);
  t.equal(r.failureMode, 'missing_biography_field');
  t.deepEqual(r.parsedKeys.sort(), ['confidence', 'notes', 'paragraphBreaks', 'sentences']);
  t.notOk(r.parsed);
  t.end();
});

test('extractJsonObject: missing_biography_field on empty biography value', function (t) {
  // Empty-string biography counts as missing — the v1 code treats
  // falsy `biography` as unusable, and diagnostics should agree.
  const text = JSON.stringify({ biography: '', confidence: 5 });
  const r = extractJsonObject(text);
  t.equal(r.failureMode, 'missing_biography_field');
  t.deepEqual(r.parsedKeys.sort(), ['biography', 'confidence']);
  t.end();
});

test('extractJsonObject: missing_biography_field with nested biography (writer put it inside data)', function (t) {
  // Model output {data: {biography: '...'}} instead of top-level.
  // Not our schema — treated as missing.
  const text = JSON.stringify({ data: { biography: 'Nested.' }, confidence: 5 });
  const r = extractJsonObject(text);
  t.equal(r.failureMode, 'missing_biography_field');
  t.deepEqual(r.parsedKeys.sort(), ['confidence', 'data']);
  t.end();
});

test('extractJsonObject: json_parse_failed with parseError populated', function (t) {
  // Truncation mid-string — the JSON is invalid, all three strategies fail.
  const text = '{"biography": "This is a truncated bio that hit max_tokens mid-str';
  const r = extractJsonObject(text);
  t.equal(r.failureMode, 'json_parse_failed');
  t.ok(r.parseError, 'parseError string populated');
  t.ok(typeof r.parseError === 'string');
  t.end();
});

test('extractJsonObject: json_parse_failed on completely non-JSON reply', function (t) {
  // Claude refusal / prose-only reply — no braces at all.
  const text = "I'm sorry, but I can't help with that.";
  const r = extractJsonObject(text);
  t.equal(r.failureMode, 'json_parse_failed');
  t.ok(r.parseError);
  t.end();
});

test('extractJsonObject: json_parse_failed distinguishes "no braces" from "bad braces"', function (t) {
  // A response with an opening brace but genuinely malformed content —
  // exercises the balanced-braces fallback then still fails.
  const text = '{ "biography": broken syntax here }';
  const r = extractJsonObject(text);
  t.equal(r.failureMode, 'json_parse_failed');
  t.ok(r.parseError);
  t.end();
});

test('extractJsonObject: returns discriminated result (never plain null)', function (t) {
  // Regression guard — the pre-refactor return was `null` on every
  // failure. Callers may rely on the object-shape return for the
  // diagnostics they attach to the record.
  const cases = [
    '',
    null,
    undefined,
    'not json',
    '{"other": 1}',
    JSON.stringify({ biography: 'ok' })
  ];
  for (const c of cases) {
    const r = extractJsonObject(c);
    t.ok(r !== null && typeof r === 'object', 'result is always an object for input: ' + JSON.stringify(c));
    t.ok(r.failureMode || r.parsed, 'either failureMode or parsed set');
  }
  t.end();
});

'use strict';

// Tests for the source-tagged writer's response parser.

const test = require('tape');
const parse = require('../lib/ai/parse-source-tagged-response');
const { signature } = require('../lib/ai/claim-signature');

function validPayload (overrides) {
  return Object.assign({
    sentences: [
      { text: 'Einstein was born in Ulm.', source: 'museum', sourceDetail: 'personData.birthPlace' },
      { text: 'He studied at ETH Zurich.', source: 'wikidata', sourceDetail: 'wikidata:P69' },
      { text: 'He worked in theoretical physics.', source: 'llm:inferred', sourceDetail: 'wikidata:P106' }
    ],
    paragraphBreaks: [1],
    confidence: 8,
    notes: 'Sample notes'
  }, overrides || {});
}

// --- Happy path ------------------------------------------------------

test('parse: valid JSON → normalised payload with claim signatures', function (t) {
  const out = parse(JSON.stringify(validPayload()));
  t.equal(out.sentences.length, 3, 'sentences preserved');
  t.equal(out.sentences[0].text, 'Einstein was born in Ulm.');
  t.equal(out.sentences[0].source, 'museum');
  t.equal(out.sentences[0].sourceDetail, 'personData.birthPlace');
  t.equal(out.sentences[0].claimSignature, signature('Einstein was born in Ulm.'), 'signature computed');
  t.deepEqual(out.paragraphBreaks, [1]);
  t.equal(out.confidence, 8);
  t.equal(out.notes, 'Sample notes');
  t.deepEqual(out.verificationCandidates, {
    generalKnowledgeCount: 0,
    contextualisingCount: 0,
    inferredCount: 1
  });
  t.end();
});

// --- Markdown-fence / prose contamination ---------------------------

test('parse: strips ```json fences', function (t) {
  const wrapped = '```json\n' + JSON.stringify(validPayload()) + '\n```';
  const out = parse(wrapped);
  t.equal(out.sentences.length, 3);
  t.end();
});

test('parse: strips bare ``` fences', function (t) {
  const wrapped = '```\n' + JSON.stringify(validPayload()) + '\n```';
  const out = parse(wrapped);
  t.equal(out.sentences.length, 3);
  t.end();
});

test('parse: extracts JSON object from surrounding prose', function (t) {
  const wrapped = 'Here is the biography:\n\n' + JSON.stringify(validPayload()) + '\n\nEnd of response.';
  const out = parse(wrapped);
  t.equal(out.sentences.length, 3);
  t.end();
});

// --- Malformed input ------------------------------------------------

test('parse: empty text throws ParseError', function (t) {
  t.throws(function () { parse(''); }, parse.ParseError);
  t.throws(function () { parse(null); }, parse.ParseError);
  t.throws(function () { parse('   '); }, parse.ParseError);
  t.end();
});

test('parse: invalid JSON throws ParseError', function (t) {
  t.throws(function () { parse('this is not JSON at all'); }, parse.ParseError);
  t.throws(function () { parse('{invalid json}'); }, parse.ParseError);
  t.end();
});

test('parse: JSON with no sentences array throws ParseError', function (t) {
  t.throws(function () { parse(JSON.stringify({ confidence: 5 })); }, parse.ParseError);
  t.throws(function () { parse(JSON.stringify({ sentences: [] })); }, parse.ParseError);
  t.end();
});

test('parse: all sentences malformed → throws ParseError', function (t) {
  const bad = JSON.stringify({
    sentences: [
      { text: '', source: 'museum' },
      { text: null, source: 'museum' },
      { source: 'museum' }
    ]
  });
  t.throws(function () { parse(bad); }, parse.ParseError);
  t.end();
});

// --- Sentence normalisation edge cases ------------------------------

test('parse: unknown source tag → coerced to llm:general_knowledge (defensive)', function (t) {
  const payload = validPayload({
    sentences: [
      { text: 'Some fact.', source: 'made-up-tag' }
    ]
  });
  const out = parse(JSON.stringify(payload));
  t.equal(out.sentences[0].source, 'llm:general_knowledge',
    'unknown tag defaults to safest (hidden by default) source');
  t.end();
});

test('parse: empty / whitespace-only sentence text dropped', function (t) {
  const payload = validPayload({
    sentences: [
      { text: 'Valid sentence.', source: 'museum' },
      { text: '', source: 'museum' },
      { text: '   \n  ', source: 'museum' },
      { text: 'Another valid one.', source: 'wikidata' }
    ]
  });
  const out = parse(JSON.stringify(payload));
  t.equal(out.sentences.length, 2, 'empty sentences dropped');
  t.end();
});

test('parse: sourceDetail defaults to null when missing / empty', function (t) {
  const payload = validPayload({
    sentences: [
      { text: 'Fact one.', source: 'museum' },
      { text: 'Fact two.', source: 'museum', sourceDetail: '' },
      { text: 'Fact three.', source: 'museum', sourceDetail: '  ' }
    ]
  });
  const out = parse(JSON.stringify(payload));
  t.equal(out.sentences[0].sourceDetail, null);
  t.equal(out.sentences[1].sourceDetail, null);
  t.equal(out.sentences[2].sourceDetail, null);
  t.end();
});

test('parse: sentence text is trimmed', function (t) {
  const payload = validPayload({
    sentences: [{ text: '  trimmed sentence.  ', source: 'museum' }]
  });
  const out = parse(JSON.stringify(payload));
  t.equal(out.sentences[0].text, 'trimmed sentence.');
  t.end();
});

// --- paragraphBreaks normalisation ----------------------------------

test('parse: out-of-range breaks dropped', function (t) {
  const payload = validPayload({
    sentences: [
      { text: 'a', source: 'museum' },
      { text: 'b', source: 'museum' },
      { text: 'c', source: 'museum' }
    ],
    paragraphBreaks: [-1, 0, 2, 5, 99]
  });
  const out = parse(JSON.stringify(payload));
  t.deepEqual(out.paragraphBreaks, [0, 2], 'kept only indices in [0, sentenceCount)');
  t.end();
});

test('parse: non-integer breaks dropped, output sorted, deduped', function (t) {
  const payload = validPayload({
    paragraphBreaks: [2, 'x', 0, 1.5, 2, null, 0]
  });
  const out = parse(JSON.stringify(payload));
  t.deepEqual(out.paragraphBreaks, [0, 2]);
  t.end();
});

test('parse: missing paragraphBreaks → empty array', function (t) {
  const payload = validPayload();
  delete payload.paragraphBreaks;
  const out = parse(JSON.stringify(payload));
  t.deepEqual(out.paragraphBreaks, []);
  t.end();
});

// --- confidence normalisation --------------------------------------

test('parse: confidence clamped / rounded / null on invalid', function (t) {
  t.equal(parse(JSON.stringify(validPayload({ confidence: 5 }))).confidence, 5);
  t.equal(parse(JSON.stringify(validPayload({ confidence: 5.7 }))).confidence, 6, 'rounded');
  t.equal(parse(JSON.stringify(validPayload({ confidence: -1 }))).confidence, null, 'out of range → null');
  t.equal(parse(JSON.stringify(validPayload({ confidence: 11 }))).confidence, null);
  t.equal(parse(JSON.stringify(validPayload({ confidence: 'high' }))).confidence, null, 'non-numeric → null');
  const noConfidence = validPayload();
  delete noConfidence.confidence;
  t.equal(parse(JSON.stringify(noConfidence)).confidence, null);
  t.end();
});

// --- notes ----------------------------------------------------------

test('parse: notes defaults to empty string when missing / non-string', function (t) {
  const noNotes = validPayload();
  delete noNotes.notes;
  t.equal(parse(JSON.stringify(noNotes)).notes, '');
  t.equal(parse(JSON.stringify(validPayload({ notes: 123 }))).notes, '');
  t.end();
});

// --- verificationCandidates counts ---------------------------------

test('parse: counts general_knowledge + contextualising + inferred separately', function (t) {
  const payload = validPayload({
    sentences: [
      { text: 'museum fact', source: 'museum' },
      { text: 'wikidata fact', source: 'wikidata' },
      { text: 'inferred synthesis', source: 'llm:inferred' },
      { text: 'era context', source: 'llm:contextualising' },
      { text: 'general knowledge claim 1', source: 'llm:general_knowledge' },
      { text: 'general knowledge claim 2', source: 'llm:general_knowledge' }
    ]
  });
  const out = parse(JSON.stringify(payload));
  t.deepEqual(out.verificationCandidates, {
    generalKnowledgeCount: 2,
    contextualisingCount: 1,
    inferredCount: 1
  });
  t.end();
});

// --- VALID_SOURCES export ------------------------------------------

test('VALID_SOURCES export is the 5-tier set', function (t) {
  t.equal(parse.VALID_SOURCES.size, 5);
  t.ok(parse.VALID_SOURCES.has('museum'));
  t.ok(parse.VALID_SOURCES.has('wikidata'));
  t.ok(parse.VALID_SOURCES.has('llm:inferred'));
  t.ok(parse.VALID_SOURCES.has('llm:contextualising'));
  t.ok(parse.VALID_SOURCES.has('llm:general_knowledge'));
  t.end();
});

// --- Citations passthrough --------------------------------------------

test('citations array passes through the parser unchanged', function (t) {
  const raw = JSON.stringify({
    sentences: [{
      text: 'Einstein was born in Ulm.',
      source: 'museum',
      sourceDetail: 'personData.birthDate, personData.briefBiography',
      citations: [
        { field: 'personData.birthDate', value: '1879-03-14' },
        { field: 'personData.briefBiography', excerpt: 'was born in Ulm, Germany' }
      ]
    }],
    confidence: 8
  });
  const result = parse(raw);
  t.equal(result.sentences[0].citations.length, 2);
  t.equal(result.sentences[0].citations[0].value, '1879-03-14');
  t.equal(result.sentences[0].citations[1].excerpt, 'was born in Ulm, Germany');
  t.end();
});

test('missing citations field → empty array on parsed sentence', function (t) {
  const raw = JSON.stringify({
    sentences: [{ text: 'text', source: 'museum', sourceDetail: 'x' }],
    confidence: 5
  });
  const result = parse(raw);
  t.deepEqual(result.sentences[0].citations, []);
  t.end();
});

test('non-object citation entries dropped at parse time', function (t) {
  const raw = JSON.stringify({
    sentences: [{
      text: 'text',
      source: 'museum',
      citations: [
        { field: 'personData.birthDate', value: '1879' },
        'nonsense', // dropped
        null, // dropped
        42, // dropped
        { field: 'wikidata:P108', value: 'ETH Zurich' }
      ]
    }],
    confidence: 5
  });
  const result = parse(raw);
  t.equal(result.sentences[0].citations.length, 2, 'only the two objects survive');
  t.end();
});

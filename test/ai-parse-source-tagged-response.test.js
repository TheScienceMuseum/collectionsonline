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

test('VALID_SOURCES export is the 8-tier set', function (t) {
  t.equal(parse.VALID_SOURCES.size, 8);
  t.ok(parse.VALID_SOURCES.has('museum'));
  t.ok(parse.VALID_SOURCES.has('wikidata'));
  t.ok(parse.VALID_SOURCES.has('wikipedia'));
  t.ok(parse.VALID_SOURCES.has('oxfordDNB'));
  t.ok(parse.VALID_SOURCES.has('gracesGuide'));
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

// --- Multi-source (spec: internal-docs/multi-source-sentence-tagging-spec.md)

test('multi-source: legacy `source: string` normalises to sources: [source]', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 't', source: 'wikidata' }],
    confidence: 5
  }));
  t.deepEqual(out.sentences[0].sources, ['wikidata'], 'wrapped in array');
  t.equal(out.sentences[0].source, 'wikidata', 'source mirrors strongest for legacy readers');
  t.end();
});

test('multi-source: `sources: [...]` preserved and sorted strongest-first', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 't', sources: ['llm:inferred', 'wikidata', 'museum'] }],
    confidence: 5
  }));
  t.deepEqual(out.sentences[0].sources, ['museum', 'wikidata', 'llm:inferred'], 'sorted strongest → weakest');
  t.equal(out.sentences[0].source, 'museum', 'source = strongest');
  t.end();
});

test('multi-source: unknown tags in `sources` array are dropped, valid ones kept', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 't', sources: ['wikidata', 'garbage', 'llm:inferred'] }],
    confidence: 5
  }));
  t.deepEqual(out.sentences[0].sources, ['wikidata', 'llm:inferred'], 'garbage dropped');
  t.end();
});

test('multi-source: all-invalid → fallback to defensive single tag', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 't', sources: ['not-real', 'also-bogus'] }],
    confidence: 5
  }));
  t.deepEqual(out.sentences[0].sources, ['llm:general_knowledge'], 'defensive fallback');
  t.equal(out.sentences[0].source, 'llm:general_knowledge');
  t.end();
});

test('multi-source: dedupes repeated tags in `sources` array', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 't', sources: ['wikidata', 'museum', 'wikidata'] }],
    confidence: 5
  }));
  t.deepEqual(out.sentences[0].sources, ['museum', 'wikidata'], 'deduped');
  t.end();
});

test('multi-source: `sources` wins over legacy `source` when both present', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 't', source: 'museum', sources: ['wikidata', 'llm:inferred'] }],
    confidence: 5
  }));
  t.deepEqual(out.sentences[0].sources, ['wikidata', 'llm:inferred'], 'sources array is canonical');
  t.equal(out.sentences[0].source, 'wikidata', 'legacy field takes strongest of new array');
  t.end();
});

test('multi-source: verification-candidate counts include mixed sentences', function (t) {
  const out = parse(JSON.stringify({
    sentences: [
      { text: 'a', sources: ['wikidata', 'llm:inferred'] },
      { text: 'b', source: 'llm:contextualising' },
      { text: 'c', sources: ['museum'] }
    ],
    confidence: 5
  }));
  t.equal(out.verificationCandidates.inferredCount, 1, 'mixed wikidata+llm:inferred counted as inferred');
  t.equal(out.verificationCandidates.contextualisingCount, 1);
  t.equal(out.verificationCandidates.generalKnowledgeCount, 0);
  t.end();
});

test('getSources helper: returns sources array when present', function (t) {
  t.deepEqual(parse.getSources({ sources: ['museum', 'wikidata'] }), ['museum', 'wikidata']);
  t.end();
});

test('getSources helper: falls back to [source] for legacy shape', function (t) {
  t.deepEqual(parse.getSources({ source: 'wikidata' }), ['wikidata']);
  t.end();
});

test('getSources helper: neither → defensive fallback', function (t) {
  t.deepEqual(parse.getSources({}), ['llm:general_knowledge']);
  t.deepEqual(parse.getSources({ sources: [] }), ['llm:general_knowledge'], 'empty array falls through');
  t.end();
});

test('SOURCE_STRENGTH_ORDER export is stable strongest-first list', function (t) {
  t.equal(parse.SOURCE_STRENGTH_ORDER[0], 'museum', 'museum is strongest');
  t.equal(parse.SOURCE_STRENGTH_ORDER[parse.SOURCE_STRENGTH_ORDER.length - 1], 'llm:general_knowledge', 'general_knowledge weakest');
  t.equal(parse.SOURCE_STRENGTH_ORDER.length, 8, '8 tiers');
  t.end();
});

// --- Per-clause parts (spec: internal-docs/per-clause-source-highlighting-spec.md)

test('parts: valid two-part sentence passes through', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'He studied at ETH Zurich, where he received his degree.',
      sources: ['wikidata', 'llm:inferred'],
      parts: [
        { text: 'He studied at ETH Zurich,', source: 'wikidata' },
        { text: ' where he received his degree.', source: 'llm:inferred' }
      ]
    }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts.length, 2, 'both parts preserved');
  t.equal(out.sentences[0].parts[0].source, 'wikidata');
  t.equal(out.sentences[0].parts[1].source, 'llm:inferred');
  t.end();
});

test('parts: absent → null', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 't', sources: ['museum'] }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts, null, 'parts field absent from writer → null');
  t.end();
});

test('parts: single-part array dropped (redundant)', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'One clause.',
      sources: ['museum'],
      parts: [{ text: 'One clause.', source: 'museum' }]
    }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts, null, 'chip stack already conveys single source');
  t.end();
});

test('parts: concat mismatch → dropped', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'He studied at ETH Zurich.',
      sources: ['wikidata', 'llm:inferred'],
      parts: [
        { text: 'He studied at ETH', source: 'wikidata' },
        { text: 'Zurich.', source: 'llm:inferred' }// missing " " between
      ]
    }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts, null, 'silent drop on rebuild mismatch');
  t.end();
});

test('parts: unknown source in a part → whole parts array dropped', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'A B.',
      sources: ['museum', 'wikidata'],
      parts: [
        { text: 'A ', source: 'museum' },
        { text: 'B.', source: 'oxfordDNB' }// not in sources
      ]
    }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts, null, 'parts referencing a source not in sources[] is invalid');
  t.end();
});

test('parts: non-object entry → dropped', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'A B.',
      sources: ['museum', 'wikidata'],
      parts: [
        { text: 'A ', source: 'museum' },
        'B.'// bare string, not an object
      ]
    }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts, null);
  t.end();
});

test('parts: empty text or empty source in a part → dropped', function (t) {
  const withEmptyText = parse(JSON.stringify({
    sentences: [{
      text: 'A B.',
      sources: ['museum', 'wikidata'],
      parts: [{ text: '', source: 'museum' }, { text: 'A B.', source: 'wikidata' }]
    }],
    confidence: 8
  }));
  t.equal(withEmptyText.sentences[0].parts, null);
  const withEmptySource = parse(JSON.stringify({
    sentences: [{
      text: 'A B.',
      sources: ['museum', 'wikidata'],
      parts: [{ text: 'A ', source: 'museum' }, { text: 'B.', source: '' }]
    }],
    confidence: 8
  }));
  t.equal(withEmptySource.sentences[0].parts, null);
  t.end();
});

test('parts: declared source with no matching part → parts survive, uncoveredSources populated', function (t) {
  // Coverage rule was REMOVED July 2026 — silent-dropping the writer's
  // real per-clause labels for one sloppy source is worse than
  // rendering what we have + flagging the uncovered source.
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'A B.',
      sources: ['wikidata', 'llm:inferred'],
      parts: [
        { text: 'A ', source: 'wikidata' },
        { text: 'B.', source: 'wikidata' }
      ]
    }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts.length, 2, 'parts render even though llm:inferred was never labelled');
  t.deepEqual(out.sentences[0].uncoveredSources, ['llm:inferred'], 'admin UI can badge the llm:inferred pill');
  t.end();
});

test('uncoveredSources: empty when every declared source has a part', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'A B.',
      sources: ['museum', 'wikidata'],
      parts: [
        { text: 'A ', source: 'museum' },
        { text: 'B.', source: 'wikidata' }
      ]
    }],
    confidence: 8
  }));
  t.deepEqual(out.sentences[0].uncoveredSources, [], 'all sources covered → no warning');
  t.end();
});

test('uncoveredSources: empty when parts is null (single-source or dropped)', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{ text: 'Plain.', sources: ['museum'] }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts, null);
  t.deepEqual(out.sentences[0].uncoveredSources, [], 'no parts → no coverage report');
  t.end();
});

test('parts: three-part sentence spanning three sources', function (t) {
  const out = parse(JSON.stringify({
    sentences: [{
      text: 'Museum bit; wikidata bit; inferred tail.',
      sources: ['museum', 'wikidata', 'llm:inferred'],
      parts: [
        { text: 'Museum bit;', source: 'museum' },
        { text: ' wikidata bit;', source: 'wikidata' },
        { text: ' inferred tail.', source: 'llm:inferred' }
      ]
    }],
    confidence: 8
  }));
  t.equal(out.sentences[0].parts.length, 3);
  t.deepEqual(out.sentences[0].parts.map(function (p) { return p.source; }), ['museum', 'wikidata', 'llm:inferred']);
  t.end();
});

test('parts: rebuilt text matches raw (untrimmed) — leading whitespace handled', function (t) {
  // Writer emits sentence.text with leading whitespace, then parts
  // that also carry it. Parser trims sentence.text for display but
  // parts validation uses the raw untrimmed text so the concat check
  // succeeds. This asserts the fix that swapped `text` (trimmed) for
  // raw.text in the concat comparison.
  const out = parse(JSON.stringify({
    sentences: [{
      text: '  He studied at ETH.',
      sources: ['wikidata'],
      parts: [
        { text: '  He studied at', source: 'wikidata' },
        { text: ' ETH.', source: 'wikidata' }
      ]
    }],
    confidence: 8
  }));
  // Single-source parts is technically valid schema, and both entries
  // reference 'wikidata' which IS in sources. Rebuilt = raw.text.
  // Should PASS (both are wikidata is a valid — if slightly odd — mix).
  t.equal(out.sentences[0].parts.length, 2, 'parts survived');
  t.equal(out.sentences[0].text, 'He studied at ETH.', 'display text trimmed');
  t.end();
});

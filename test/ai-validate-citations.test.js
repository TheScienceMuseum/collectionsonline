'use strict';

// Tests for the strict-verbatim citation validator.
//
// Fixtures mirror what the writer sees at generation time — personData,
// relatedItems, wikidataContext — so each test exercises the actual
// validation surface the pipeline will hit.

const test = require('tape');
const validateCitations = require('../lib/ai/validate-citations');

// --- Fixtures --------------------------------------------------------

function inputs () {
  return {
    personData: {
      name: 'Albert Einstein',
      birthDate: '1879-03-14',
      birthPlace: 'Ulm',
      occupation: 'physicist',
      briefBiography: 'Albert Einstein (1879-1955) was born in Ulm, Germany. Nobel laureate; developed the special theory of relativity.'
    },
    wikidataContext: {
      P108: [
        { label: 'ETH Zurich', qcode: 'Q11942' },
        { label: 'Institute for Advanced Study', qcode: 'Q1223' }
      ],
      P19: 'Ulm'
    },
    relatedItems: [
      {
        id: 'co66082',
        title: 'Bust of Albert Einstein (1879-1955)',
        description: 'A bronze bust by Jacob Epstein, produced during informal morning sittings.'
      },
      {
        id: 'co66081',
        title: 'Einstein in Norfolk',
        description: 'A signed photograph taken with Commander Locker-Lampson MP.'
      }
    ]
  };
}

function sentence (source, citations) {
  return { text: 'Some prose the reader sees.', source, citations };
}

// --- Source-eligibility filter --------------------------------------

test('non-eligible sources have citations stripped even if writer emitted them', function (t) {
  const diagnostics = [];
  const out = validateCitations([
    sentence('llm:inferred', [{ field: 'personData.birthDate', value: '1879-03-14' }]),
    sentence('llm:contextualising', [{ field: 'personData.name', value: 'Albert Einstein' }]),
    sentence('llm:general_knowledge', [{ field: 'personData.briefBiography', excerpt: 'Nobel laureate' }])
  ], inputs(), { diagnostics });

  t.deepEqual(out[0].citations, []);
  t.deepEqual(out[1].citations, []);
  t.deepEqual(out[2].citations, []);
  t.equal(diagnostics.length, 3, 'each stripped citation logged');
  t.ok(diagnostics.every(function (d) { return d.reason === 'source_ineligible'; }));
  t.end();
});

test('museum + wikidata + llm:validated:* sources are eligible', function (t) {
  t.ok(validateCitations.isCitationEligibleSource('museum'));
  t.ok(validateCitations.isCitationEligibleSource('wikidata'));
  t.ok(validateCitations.isCitationEligibleSource('llm:validated:wikipedia'));
  t.ok(validateCitations.isCitationEligibleSource('llm:validated:wikidata-deep'));
  t.notOk(validateCitations.isCitationEligibleSource('llm:inferred'));
  t.notOk(validateCitations.isCitationEligibleSource('llm:contextualising'));
  t.notOk(validateCitations.isCitationEligibleSource('llm:general_knowledge'));
  t.notOk(validateCitations.isCitationEligibleSource('random-string'));
  t.notOk(validateCitations.isCitationEligibleSource(null));
  t.notOk(validateCitations.isCitationEligibleSource(undefined));
  t.end();
});

// --- Structural rules -----------------------------------------------

test('citation missing field is rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ value: '1879-03-14' }])],
    inputs(),
    { diagnostics }
  );
  t.deepEqual(out[0].citations, []);
  t.equal(diagnostics[0].reason, 'missing_field');
  t.end();
});

test('citation with both value AND excerpt is rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.birthDate', value: '1879-03-14', excerpt: 'was born' }])],
    inputs(),
    { diagnostics }
  );
  t.deepEqual(out[0].citations, []);
  t.equal(diagnostics[0].reason, 'value_and_excerpt');
  t.end();
});

test('citation with neither value NOR excerpt is rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.birthDate' }])],
    inputs(),
    { diagnostics }
  );
  t.deepEqual(out[0].citations, []);
  t.equal(diagnostics[0].reason, 'no_anchor');
  t.end();
});

test('citation with unknown field prefix is rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'nonsense.field', value: 'x' }])],
    inputs(),
    { diagnostics }
  );
  t.deepEqual(out[0].citations, []);
  t.equal(diagnostics[0].reason, 'unknown_field_prefix');
  t.end();
});

// --- personData validation ------------------------------------------

test('personData: value matches → accepted', function (t) {
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.birthDate', value: '1879-03-14' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.equal(out[0].citations[0].value, '1879-03-14');
  t.end();
});

test('personData: value mismatch → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.birthDate', value: '1879-03-15' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'value_mismatch');
  t.end();
});

test('personData: excerpt as verbatim substring → accepted', function (t) {
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.briefBiography', excerpt: 'was born in Ulm, Germany' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.equal(out[0].citations[0].excerpt, 'was born in Ulm, Germany');
  t.end();
});

test('personData: excerpt not verbatim → rejected (paraphrase blocked)', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.briefBiography', excerpt: 'birthplace: Ulm, born 1879' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'excerpt_not_verbatim');
  t.end();
});

test('personData: casing mismatch → rejected (strict verbatim)', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.briefBiography', excerpt: 'was Born in Ulm' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0, 'no case-fold — "was Born" ≠ "was born"');
  t.equal(diagnostics[0].reason, 'excerpt_not_verbatim');
  t.end();
});

test('personData: unknown field key → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.nonsense', value: 'x' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'unknown_personData_field');
  t.end();
});

test('personData: field empty in input → rejected', function (t) {
  const diagnostics = [];
  const input = inputs();
  delete input.personData.deathDate;
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.deathDate', value: '1955-04-18' }])],
    input,
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'field_not_in_input');
  t.end();
});

// --- Wikidata validation --------------------------------------------

test('wikidata: value matches a claim label → accepted', function (t) {
  const out = validateCitations(
    [sentence('wikidata', [{ field: 'wikidata:P108', value: 'ETH Zurich' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.equal(out[0].citations[0].value, 'ETH Zurich');
  t.end();
});

test('wikidata: value mismatch → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('wikidata', [{ field: 'wikidata:P108', value: 'Made-up University' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'value_mismatch');
  t.end();
});

test('wikidata: bad Pcode format → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('wikidata', [{ field: 'wikidata:nonsense', value: 'x' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'bad_wikidata_pcode');
  t.end();
});

test('wikidata: property missing from context → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('wikidata', [{ field: 'wikidata:P999', value: 'x' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'wikidata_property_missing');
  t.end();
});

test('wikidata: raw string claim value matches → accepted', function (t) {
  const out = validateCitations(
    [sentence('wikidata', [{ field: 'wikidata:P19', value: 'Ulm' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.end();
});

// --- Related item validation ----------------------------------------

test('relatedItem: value equal to item.id → accepted', function (t) {
  const out = validateCitations(
    [sentence('museum', [{ field: 'relatedItem:co66082', value: 'co66082' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.end();
});

test('relatedItem: value equal to item.title → accepted', function (t) {
  const out = validateCitations(
    [sentence('museum', [{ field: 'relatedItem:co66082', value: 'Bust of Albert Einstein (1879-1955)' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.end();
});

test('relatedItem: excerpt matches item.title verbatim → accepted', function (t) {
  const out = validateCitations(
    [sentence('museum', [{ field: 'relatedItem:co66082', excerpt: 'Bust of Albert Einstein' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.end();
});

test('relatedItem: excerpt matches item.description verbatim → accepted', function (t) {
  const out = validateCitations(
    [sentence('museum', [{ field: 'relatedItem:co66081', excerpt: 'signed photograph taken with Commander Locker-Lampson MP' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 1);
  t.end();
});

test('relatedItem: excerpt not in title or description → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'relatedItem:co66082', excerpt: 'made up description text' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'excerpt_not_verbatim');
  t.end();
});

test('relatedItem: unknown coId → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'relatedItem:co99999', value: 'x' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'related_item_missing');
  t.end();
});

test('relatedItem: bad coId format → rejected', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'relatedItem:not-a-real-id', value: 'x' }])],
    inputs(),
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics[0].reason, 'bad_related_item_id');
  t.end();
});

// --- Mixed / real-world shapes --------------------------------------

test('mixed: valid + invalid citations in same sentence → only valid retained', function (t) {
  const diagnostics = [];
  const out = validateCitations([
    sentence('museum', [
      { field: 'personData.birthDate', value: '1879-03-14' }, // OK
      { field: 'personData.briefBiography', excerpt: 'was born in Ulm, Germany' }, // OK
      { field: 'personData.briefBiography', excerpt: 'invented in a lab' }, // fail
      { field: 'wikidata:P999', value: 'x' } // fail (property missing)
    ])
  ], inputs(), { diagnostics });

  t.equal(out[0].citations.length, 2, 'two valid retained');
  t.equal(diagnostics.length, 2, 'two failures logged');
  t.end();
});

test('multiple sentences → each processed independently', function (t) {
  const out = validateCitations([
    sentence('museum', [{ field: 'personData.birthDate', value: '1879-03-14' }]),
    sentence('wikidata', [{ field: 'wikidata:P108', value: 'ETH Zurich' }]),
    sentence('llm:inferred', [{ field: 'personData.name', value: 'Albert Einstein' }])
  ], inputs());

  t.equal(out[0].citations.length, 1);
  t.equal(out[1].citations.length, 1);
  t.equal(out[2].citations.length, 0, 'llm:inferred citation stripped');
  t.end();
});

// --- Non-destructive / defensive ------------------------------------

test('input sentence array is not mutated', function (t) {
  const original = sentence('museum', [
    { field: 'personData.birthDate', value: '1879-03-14' },
    { field: 'nonsense', value: 'x' }
  ]);
  const snapshot = JSON.parse(JSON.stringify(original));
  validateCitations([original], inputs());
  t.deepEqual(original, snapshot, 'input untouched');
  t.end();
});

test('null / undefined sentences array → returns empty array (no throw)', function (t) {
  t.deepEqual(validateCitations(null, inputs()), []);
  t.deepEqual(validateCitations(undefined, inputs()), []);
  t.end();
});

test('missing inputs → citations rejected gracefully (no throw)', function (t) {
  const diagnostics = [];
  const out = validateCitations(
    [sentence('museum', [{ field: 'personData.birthDate', value: '1879-03-14' }])],
    null,
    { diagnostics }
  );
  t.equal(out[0].citations.length, 0);
  t.equal(diagnostics.length, 1);
  t.end();
});

test('missing diagnostics opt → still runs, just no logging', function (t) {
  const out = validateCitations(
    [sentence('museum', [{ field: 'nonsense', value: 'x' }])],
    inputs()
  );
  t.equal(out[0].citations.length, 0);
  t.end();
});

test('citations field entirely absent on sentence → returns empty citations', function (t) {
  const out = validateCitations(
    [{ text: 'no citations field', source: 'museum' }],
    inputs()
  );
  t.deepEqual(out[0].citations, []);
  t.end();
});

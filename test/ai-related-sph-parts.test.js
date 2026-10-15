'use strict';

// Tests for lib/ai/related-sph-parts — SPH part records turned into
// writer items keyed on their parent object. Fixtures are trimmed ES
// hits shaped like the real records that motivated the change (Murray,
// Sons & Co's cigarette-card set co8339712 inside parent co532218).

const test = require('tape');
const appendSphPartItems = require('../lib/ai/related-sph-parts');
const { collapseSphParts, sphParent } = appendSphPartItems;
const { deriveReferencesFromSentences } = require('../lib/ai/regenerate-biography');
const validateCitations = require('../lib/ai/validate-citations');
const { linkifyObjectMarkers } = require('../lib/ai/render-biography');

const PERSON = 'cp136345';

// --- Fixtures --------------------------------------------------------

function partHit (id, opts) {
  opts = opts || {};
  const source = {
    '@datatype': { base: 'object' },
    summary: { title: opts.title === undefined ? 'Part ' + id : opts.title },
    title: opts.title ? [{ type: 'catalogue title', value: opts.title, primary: true }] : [],
    description: opts.description
      ? [{ type: 'catalogue description', value: opts.description, primary: true }]
      : [],
    creation: {
      maker: [
        // Literal copy without a uid — must not be picked as the person.
        { summary: { title: 'Literal maker' }, '@link': { source: 'catalogue' }, '@entity': 'literal' },
        {
          summary: { title: 'Murray, Sons and Company Limited' },
          '@link': opts.role ? { role: [{ value: opts.role }] } : {},
          '@admin': { uid: opts.makerUid || PERSON },
          '@entity': 'reference'
        }
      ]
    }
  };
  if (opts.parentUid !== null) {
    source.grouping = [
      {
        summary: { title: opts.parentTitle === undefined ? 'Parent ' + (opts.parentUid || 'co1') : opts.parentTitle },
        '@link': { type: 'SPH' },
        '@admin': { uid: opts.parentUid || 'co1', id: 'object-1' },
        '@entity': 'reference'
      }
    ];
  }
  return { _index: 'ciim', _id: id, _score: opts.score || 1, _source: source };
}

function murrayHit () {
  return partHit('co8339712', {
    title: "Set of 'Types of Aeroplanes' cigarette cards",
    description: "Set of cigarette cards, 'Types of Aeroplanes'. A series of 25, Murray, Sons & Co Ltd, Belfast.",
    parentUid: 'co532218',
    parentTitle: 'Sets of aviation and aviator related cigarette cards (cigarette cards)',
    role: 'maker'
  });
}

function stubElastic (hits) {
  const calls = [];
  return {
    calls,
    search: async function (opts, reqOpts) {
      calls.push({ opts, reqOpts });
      return { body: { hits: { total: { value: hits.length, relation: 'eq' }, hits } } };
    }
  };
}

// --- sphParent -------------------------------------------------------

test('sphParent reads the SPH grouping entry', function (t) {
  t.deepEqual(sphParent(murrayHit()), {
    id: 'co532218',
    title: 'Sets of aviation and aviator related cigarette cards (cigarette cards)'
  });
  t.equal(sphParent(partHit('co9', { parentUid: null })), null, 'no SPH grouping → null');
  t.equal(sphParent(null), null);
  t.end();
});

// --- collapseSphParts ------------------------------------------------

test('a lone part becomes an item keyed on its parent, keeping the part title + description', function (t) {
  const out = collapseSphParts([murrayHit()], PERSON);
  t.equal(out.length, 1);
  const item = out[0];
  t.equal(item.id, 'co532218', 'id is the parent');
  t.equal(item.link, '/objects/co532218', 'link is the parent page');
  t.equal(item.type, 'object');
  t.equal(item.title, "Set of 'Types of Aeroplanes' cigarette cards", 'title is the part title');
  t.ok(item.description.indexOf("Set of cigarette cards, 'Types of Aeroplanes'.") === 0, 'part description leads');
  t.ok(item.description.indexOf('(Catalogued as a part of "Sets of aviation and aviator related cigarette cards (cigarette cards)"') !== -1,
    'part-of note names the parent');
  t.equal(item.role, 'maker', 'role comes from the part\'s maker link for this person');
  t.deepEqual(item.partIds, ['co8339712']);
  t.end();
});

test('parts whose parent is already a linked whole object are dropped (case-insensitive)', function (t) {
  const hits = [
    murrayHit(),
    partHit('co20', { parentUid: 'co200' })
  ];
  const out = collapseSphParts(hits, PERSON, { excludeIds: ['CO532218', 'co999'] });
  t.deepEqual(out.map(function (i) { return i.id; }), ['co200']);
  t.end();
});

test('several parts of one parent collapse to one item led by the highest-ranked part', function (t) {
  const hits = [
    partHit('co11', { title: 'Safety lamp', description: 'Safety lamp, Clanny type.', parentUid: 'co100' }),
    partHit('co21', { title: 'Tourniquet', parentUid: 'co200', role: 'maker' }),
    partHit('co12', { title: 'Key for safety lamp', parentUid: 'co100', role: 'production details' }),
    partHit('co13', { title: 'Shield', parentUid: 'co100' })
  ];
  const out = collapseSphParts(hits, PERSON);
  t.deepEqual(out.map(function (i) { return i.id; }), ['co100', 'co200'], 'parent order follows first appearance');
  const lamp = out[0];
  t.equal(lamp.title, 'Safety lamp');
  t.deepEqual(lamp.partIds, ['co11', 'co12', 'co13']);
  t.ok(lamp.description.indexOf('Other credited parts of the same record: "Key for safety lamp"; "Shield".') !== -1,
    'sibling part titles named in the note');
  t.equal(lamp.role, 'production details', 'role taken from the first part that has one');
  t.end();
});

test('sibling titles beyond five are summarised as "and N more"', function (t) {
  const hits = [];
  for (let i = 0; i < 8; i++) hits.push(partHit('co5' + i, { title: 'Card ' + i, parentUid: 'co500' }));
  const out = collapseSphParts(hits, PERSON);
  t.equal(out.length, 1);
  t.ok(out[0].description.indexOf('"Card 5" and 2 more.') !== -1, out[0].description);
  t.notOk(out[0].description.indexOf('"Card 6"') !== -1);
  t.end();
});

test('falls back to the parent title when the part has no title of its own', function (t) {
  const out = collapseSphParts([
    partHit('co31', { title: '', parentUid: 'co300', parentTitle: 'Calendar pack for Enovid (bottle; tablet)' })
  ], PERSON);
  t.equal(out[0].title, 'Calendar pack for Enovid (bottle; tablet)');
  t.ok(out[0].description.indexOf('(Catalogued as a part of "Calendar pack for Enovid') === 0,
    'with no part description the note is the whole description');
  t.end();
});

test('parts without an SPH parent uid are skipped', function (t) {
  t.deepEqual(collapseSphParts([partHit('co41', { parentUid: null })], PERSON), []);
  t.deepEqual(collapseSphParts([], PERSON), []);
  t.deepEqual(collapseSphParts(null, PERSON), []);
  t.end();
});

test('long part descriptions are truncated like whole objects, note still appended', function (t) {
  const long = 'First sentence of a long catalogue entry. ' + 'More detail here. '.repeat(60);
  const out = collapseSphParts([partHit('co61', { title: 'Thing', description: long, parentUid: 'co600' })], PERSON);
  const note = out[0].description.slice(out[0].description.indexOf('(Catalogued'));
  t.ok(out[0].description.length - note.length <= 501, 'part description capped at the 500-char limit');
  t.ok(note.indexOf('(Catalogued as a part of "Parent co600"') === 0);
  t.end();
});

// --- appendSphPartItems ----------------------------------------------

test('appendSphPartItems queries parts for the person and fills only the free slots', async function (t) {
  const elastic = stubElastic([
    partHit('co11', { parentUid: 'co100' }),
    partHit('co21', { parentUid: 'co200' }), // parent already linked
    partHit('co31', { parentUid: 'co300' }),
    partHit('co41', { parentUid: 'co400' })
  ]);
  const whole = [
    { id: 'co200', title: 'Whole object', type: 'object' },
    { id: 'co201', title: 'Another whole object', type: 'object' }
  ];
  const out = await appendSphPartItems(elastic, PERSON, whole, 4);

  t.deepEqual(out.map(function (i) { return i.id; }), ['co200', 'co201', 'co100', 'co300'],
    'whole objects first, then deduped part parents up to the cap');
  t.equal(elastic.calls.length, 1);
  const body = elastic.calls[0].opts.body;
  t.equal(body.size, 4, 'fetches up to the cap');
  const bool = body.query.function_score.query.bool;
  t.deepEqual(bool.should, [
    { match: { 'creation.maker.@admin.uid': PERSON } },
    { match: { 'agent.@admin.uid': PERSON } }
  ], 'same person match as getRelatedItems');
  t.deepEqual(bool.filter, [
    { term: { 'grouping.@link.type': 'SPH' } },
    { term: { '@datatype.base': 'object' } }
  ], 'SPH object parts only');
  t.end();
});

test('appendSphPartItems skips the ES call when whole objects fill the list', async function (t) {
  const elastic = stubElastic([partHit('co11', { parentUid: 'co100' })]);
  const whole = [{ id: 'co1' }, { id: 'co2' }];
  const out = await appendSphPartItems(elastic, PERSON, whole, 2);
  t.equal(out, whole, 'returns the input untouched');
  t.equal(elastic.calls.length, 0);
  t.end();
});

test('appendSphPartItems propagates ES failures to the caller', async function (t) {
  const elastic = { search: async function () { throw new Error('timeout'); } };
  try {
    await appendSphPartItems(elastic, PERSON, [], 100);
    t.fail('expected a throw');
  } catch (err) {
    t.equal(err.message, 'timeout');
  }
  t.end();
});

// --- downstream: citations, references, inline links -----------------

test('parent-keyed items resolve through validation, references and inline markers', function (t) {
  const relatedItems = collapseSphParts([murrayHit()], PERSON);
  const sentences = [{
    text: 'Its {co532218|Types of Aeroplanes} cigarette cards are in the collection.',
    source: 'museum',
    sourceDetail: 'relatedItem:co532218',
    citations: [
      { field: 'relatedItem:co532218', value: "Set of 'Types of Aeroplanes' cigarette cards" },
      { field: 'relatedItem:co532218', excerpt: 'Sets of aviation and aviator related cigarette cards' }
    ]
  }];

  const diagnostics = [];
  const validated = validateCitations(sentences, { personData: {}, relatedItems }, { diagnostics });
  t.equal(validated[0].citations.length, 2, 'title value and part-of excerpt both validate');
  t.deepEqual(diagnostics, []);
  t.equal(validated[0].citations[0].href, '/objects/co532218');

  t.deepEqual(deriveReferencesFromSentences(validated, relatedItems, {}), [{
    id: 'co532218',
    title: "Set of 'Types of Aeroplanes' cigarette cards",
    link: '/objects/co532218',
    type: 'object'
  }], 'reference carries the part title and the parent link');

  t.ok(linkifyObjectMarkers(sentences[0].text).indexOf('href="/objects/co532218"') !== -1,
    'inline marker links to the parent page');
  t.end();
});

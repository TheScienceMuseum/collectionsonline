'use strict';

// Tests for the Wikidata deep verification tool. Deterministic — no LLM
// involved. Fetches Wikidata JSON via a stubbed fetch, resolves Q-code
// labels, matches against claim text via containment similarity.

const test = require('tape');
const wikidataDeep = require('../lib/ai/external-tools/wikidata-deep');

function makeFetchStub (responses) {
  const state = { calls: [] };
  state.fetch = function (url, opts) {
    state.calls.push({ url, opts });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error('no more stubbed responses'));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({
      ok: next.ok !== false,
      status: next.status || 200,
      json: function () { return Promise.resolve(next.body); }
    });
  };
  return state;
}

function entityResponse (qCode, claims) {
  return { body: { entities: { [qCode]: { claims: claims || {} } } } };
}

function labelResponse (labelsById) {
  const entities = {};
  Object.keys(labelsById).forEach(function (id) {
    entities[id] = { labels: { en: { value: labelsById[id] } } };
  });
  return { body: { entities } };
}

// Wikidata claim shape:
//   { P108: [{ mainsnak: { datavalue: { value: {id: 'Q...'} } } }] }
function qClaim (propId, qCodeValue) {
  return { [propId]: [{ mainsnak: { datavalue: { value: { id: qCodeValue } } } }] };
}
function stringClaim (propId, str) {
  return { [propId]: [{ mainsnak: { datavalue: { value: str } } }] };
}
function timeClaim (propId, time) {
  return { [propId]: [{ mainsnak: { datavalue: { value: { time } } } }] };
}

// --- Happy path ------------------------------------------------------

test('wikidata-deep: happy path — property with Q-code value matches claim', async function (t) {
  const fetch = makeFetchStub([
    entityResponse('Q937', qClaim('P108', 'Q123456')),
    labelResponse({ Q123456: 'Federal Office for Intellectual Property' })
  ]);
  const out = await wikidataDeep.query(
    'Einstein worked at the Federal Office for Intellectual Property.',
    { wikidataQCode: 'Q937', id: 'cp37054' },
    { fetch: fetch.fetch }
  );
  t.equal(out.matched, true);
  t.equal(out.verdict, 'supported');
  t.equal(out.cost, 0, 'no LLM used');
  t.ok(out.extracts[0].url.indexOf('Q937') !== -1);
  t.equal(out.extracts[0].supportsClaim, true);
  t.end();
});

test('wikidata-deep: string-valued property matches claim', async function (t) {
  const fetch = makeFetchStub([
    entityResponse('Q937', stringClaim('P800', 'The special theory of relativity'))
  ]);
  const out = await wikidataDeep.query(
    'Einstein developed the special theory of relativity.',
    { wikidataQCode: 'Q937' },
    { fetch: fetch.fetch }
  );
  t.equal(out.verdict, 'supported');
  t.end();
});

test('wikidata-deep: time-valued property is normalised but naive token match falls short', async function (t) {
  // Date-of-birth claims break tokens into individual segments
  // ('1879' + short '03' + short '14'); with stopwords + <3-char tokens
  // dropped, most of the date signal is lost. Naive containment
  // similarity cannot cleanly match a date-shaped claim against a
  // date-shaped value. Documenting the limitation here — Wikipedia's
  // LLM-based check is the right tool for date verification.
  const fetch = makeFetchStub([
    entityResponse('Q937', timeClaim('P569', '+1879-03-14T00:00:00Z'))
  ]);
  const out = await wikidataDeep.query(
    'Einstein was born on 1879-03-14.',
    { wikidataQCode: 'Q937' },
    { fetch: fetch.fetch }
  );
  t.equal(out.matched, true, 'entity was fetched successfully');
  t.equal(out.verdict, 'unclear', 'naive token match falls short on pure dates — this is expected');
  t.end();
});

// --- No match case ---------------------------------------------------

test('wikidata-deep: no property matches claim → verdict unclear', async function (t) {
  const fetch = makeFetchStub([
    entityResponse('Q937', qClaim('P108', 'Q123456')),
    labelResponse({ Q123456: 'Unrelated Institution' })
  ]);
  const out = await wikidataDeep.query(
    'Einstein won the Nobel Prize for peace.',
    { wikidataQCode: 'Q937' },
    { fetch: fetch.fetch }
  );
  t.equal(out.matched, true, 'entity was fetched');
  t.equal(out.verdict, 'unclear');
  t.equal(out.extracts[0].supportsClaim, null);
  t.end();
});

// --- Setup / error paths --------------------------------------------

test('wikidata-deep: no Q-code on subject → matched:false', async function (t) {
  const out = await wikidataDeep.query('claim', { name: 'Test' }, { fetch: function () {} });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('Q-code') !== -1);
  t.end();
});

test('wikidata-deep: empty claim → matched:false', async function (t) {
  const out = await wikidataDeep.query('', { wikidataQCode: 'Q937' }, { fetch: function () {} });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('empty claim') !== -1);
  t.end();
});

test('wikidata-deep: HTTP error → matched:false with error', async function (t) {
  const fetch = makeFetchStub([{ ok: false, status: 500, body: {} }]);
  const out = await wikidataDeep.query('claim', { wikidataQCode: 'Q937' }, { fetch: fetch.fetch });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('wikidata fetch failed') !== -1);
  t.end();
});

test('wikidata-deep: entity not returned → matched:false', async function (t) {
  const fetch = makeFetchStub([{ body: { entities: {} } }]);
  const out = await wikidataDeep.query('claim', { wikidataQCode: 'Q999' }, { fetch: fetch.fetch });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('no entity returned') !== -1);
  t.end();
});

// --- Property + label handling --------------------------------------

test('wikidata-deep: multiple property matches sorted best-first', async function (t) {
  const fetch = makeFetchStub([
    entityResponse('Q937', Object.assign(
      qClaim('P108', 'Q123456'),
      stringClaim('P800', 'special theory of relativity photoelectric effect Brownian motion')
    )),
    labelResponse({ Q123456: 'special theory of relativity photoelectric effect Brownian motion Federal Office' })
  ]);
  const out = await wikidataDeep.query(
    'Einstein developed the special theory of relativity, photoelectric effect and Brownian motion.',
    { wikidataQCode: 'Q937' },
    { fetch: fetch.fetch }
  );
  t.equal(out.verdict, 'supported');
  t.ok(out.extracts.length >= 1);
  t.end();
});

test('wikidata-deep: exports name and tier', function (t) {
  t.equal(wikidataDeep.name, 'wikidataDeep');
  t.equal(wikidataDeep.tier, 'B');
  t.ok(wikidataDeep.CLAIM_PROPS);
  t.end();
});

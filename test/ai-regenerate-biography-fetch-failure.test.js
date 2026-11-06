'use strict';

// lib/ai/regenerate-biography must not write a biography when the
// collection items can't be fetched. It used to log and carry on with no
// items, so an Elasticsearch timeout produced a bio whose prompt said "No
// collection items linked to this person" and which lost its "In the
// collection" paragraph. Now it throws before anything is saved, and
// bulk-generate retries the id like any other error.

const test = require('tape');
const sinon = require('sinon');
const regenerateBiography = require('../lib/ai/regenerate-biography');
const biographyStore = require('../lib/ai/biography-store');

const ID = 'cp120947';
const PERSON_SOURCE = {
  '@datatype': { base: 'agent' },
  '@admin': { uid: ID },
  summary: { title: 'Test Person' },
  name: [{ value: 'Test Person', primary: true }]
};

// An ES client whose person lookup works and whose searches are answered
// in turn by `searches` (a function to throw, or a body to return).
function fakeElastic (searches) {
  let call = 0;
  return {
    get: async function () { return { body: { _source: PERSON_SOURCE } }; },
    search: async function () {
      const next = searches[call++];
      if (typeof next === 'function') return next();
      return { body: next };
    }
  };
}

function timeout () { throw new Error('Request timed out'); }

const NO_HITS = { hits: { total: { value: 0, relation: 'eq' }, hits: [] } };

test('a timed-out related-items fetch throws and saves nothing', async function (t) {
  const save = sinon.stub(biographyStore, 'saveBiography').resolves();
  try {
    await regenerateBiography(fakeElastic([timeout]), {}, ID);
    t.fail('expected regenerateBiography to throw');
  } catch (err) {
    t.match(err.message, /^Related items fetch failed: Request timed out/, 'error names the failed fetch');
  } finally {
    save.restore();
  }
  t.equal(save.callCount, 0, 'no BIOGRAPHY item is written');
  t.end();
});

test('a timed-out SPH parts fetch throws and saves nothing', async function (t) {
  const save = sinon.stub(biographyStore, 'saveBiography').resolves();
  try {
    await regenerateBiography(fakeElastic([NO_HITS, timeout]), {}, ID);
    t.fail('expected regenerateBiography to throw');
  } catch (err) {
    t.match(err.message, /^SPH parts fetch failed: Request timed out/, 'error names the failed fetch');
  } finally {
    save.restore();
  }
  t.equal(save.callCount, 0, 'no BIOGRAPHY item is written');
  t.end();
});

const test = require('tape');
const sinon = require('sinon');
const config = require('../config');
const search = require('../lib/search');
const searchWeights = require('../lib/search-weights');
const createQueryParams = require('../lib/query-params/query-params');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

// Biographies are description[] entries with type 'biography'; there is no
// top-level `biography` field, so clauses on it never fired (#2238).
const BIOGRAPHY_WEIGHT = {
  filter: { term: { 'description.type': 'biography' } },
  weight: 1.2
};
const isBiographyWeight = (f) => !!(f.filter && f.filter.term && f.filter.term['description.type']);
const isBiographyField = (field) => field.split('^')[0] === 'biography';

async function functionScore (query, type) {
  const elastic = { search: sinon.stub().resolves({ body: {} }) };
  await search(elastic, createQueryParams('json', { query, params: { type } }));
  return elastic.search.firstCall.args[0].body.query.function_score;
}

test(file + 'People tab weights agents with a biography entry', async (t) => {
  const { functions } = await functionScore({ q: 'babbage' }, 'people');
  t.plan(1);
  t.deepEqual(functions.filter(isBiographyWeight), [BIOGRAPHY_WEIGHT], 'description.type biography weight present');
  t.end();
});

test(file + 'All tab does not weight biographies', async (t) => {
  const { functions } = await functionScore({ q: 'camera' }, 'all');
  t.plan(1);
  t.notOk(functions.some(isBiographyWeight), 'no biography weight on the all tab');
  t.end();
});

test(file + 'Production weights gate the biography weight the same way', (t) => {
  const env = config.NODE_ENV;
  config.NODE_ENV = 'production';
  try {
    t.plan(2);
    t.deepEqual(searchWeights('people').filter(isBiographyWeight), [BIOGRAPHY_WEIGHT], 'people tab');
    t.deepEqual(searchWeights('all').filter(isBiographyWeight), [], 'all tab');
  } finally {
    config.NODE_ENV = env;
  }
  t.end();
});

test(file + 'No clause references a top-level biography field', async (t) => {
  for (const type of ['all', 'people']) {
    const { query, functions } = await functionScore({ q: 'babbage' }, type);
    const should = query.bool.should;
    t.notOk(
      functions.some(f => f.filter && f.filter.exists && isBiographyField(f.filter.exists.field)),
      `${type}: no exists:biography weight`
    );
    t.notOk(
      should.some(c => c.match_phrase && Object.keys(c.match_phrase).some(isBiographyField)),
      `${type}: no match_phrase on biography`
    );
    t.notOk(
      should.some(c => c.multi_match && c.multi_match.fields.some(isBiographyField)),
      `${type}: no biography in multi_match fields`
    );
  }
  t.end();
});

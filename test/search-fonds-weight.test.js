const test = require('tape');
const sinon = require('sinon');
const config = require('../config');
const search = require('../lib/search');
const createQueryParams = require('../lib/query-params/query-params');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

// The fonds weight lifts a top-level fonds above the lower-level records of its own
// archive: 2 on the documents tab, a light 0.5 on the all tab, none elsewhere.
const fondsWeight = (weight) => ({ filter: { term: { 'level.value': 'fonds' } }, weight });
const isFondsWeight = (f) => !!(f.filter && f.filter.term && f.filter.term['level.value'] === 'fonds');
const isAnalytics = (f) => !!f.field_value_factor;
const EXCLUDE_ARCHIVES = { bool: { must_not: [{ term: { '@datatype.base': 'archive' } }] } };

// The fonds and analytics weights are production-only (test keeps fixture ordering
// stable), so the production path is reached by toggling NODE_ENV.
async function productionFunctions (query, type) {
  const env = config.NODE_ENV;
  config.NODE_ENV = 'production';
  try {
    const elastic = { search: sinon.stub().resolves({ body: {} }) };
    await search(elastic, createQueryParams('json', { query, params: { type } }));
    return elastic.search.firstCall.args[0].body.query.function_score.functions;
  } finally {
    config.NODE_ENV = env;
  }
}

test(file + 'All tab gives fonds a light 0.5 weight', async (t) => {
  const functions = await productionFunctions({ q: 'gec traction' }, 'all');
  t.plan(2);
  t.deepEqual(functions.filter(isFondsWeight), [fondsWeight(0.5)], 'fonds weight 0.5');
  t.deepEqual(functions.find(isAnalytics).filter, EXCLUDE_ARCHIVES, 'archives still get no analytics');
  t.end();
});

test(file + 'Documents tab gives fonds a weight of 2', async (t) => {
  const functions = await productionFunctions({ q: 'gec traction' }, 'documents');
  t.plan(1);
  t.deepEqual(functions.filter(isFondsWeight), [fondsWeight(2)], 'fonds weight 2');
  t.end();
});

test(file + 'Other tabs get no fonds weight', async (t) => {
  t.plan(2);
  for (const type of ['people', 'objects']) {
    const functions = await productionFunctions({ q: 'gec traction' }, type);
    t.notOk(functions.some(isFondsWeight), `${type}: no fonds weight`);
  }
  t.end();
});

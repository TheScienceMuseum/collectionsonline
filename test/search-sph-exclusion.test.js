const test = require('tape');
const sinon = require('sinon');
const search = require('../lib/search');
const createQueryParams = require('../lib/query-params/query-params');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

// SPH component parts must be excluded on every search path, including browse
// (no q) and random, which replace the text clauses (#2240).
const SPH_EXCLUSION = { terms: { 'grouping.@link.type': ['SPH'] } };

async function searchBody (query, type) {
  const elastic = { search: sinon.stub().resolves({ body: {} }) };
  await search(elastic, createQueryParams('json', { query, params: { type } }));
  return elastic.search.firstCall.args[0].body;
}

test(file + 'Text query excludes SPH parts', async (t) => {
  const { bool } = (await searchBody({ q: 'engine' }, 'objects')).query.function_score.query;
  t.plan(2);
  t.deepEqual(bool.must_not, [SPH_EXCLUSION], 'must_not excludes SPH parts');
  t.ok(bool.should.length > 0, 'text clauses present');
  t.end();
});

test(file + 'Browse (no q) keeps the search-space filter and SPH exclusion', async (t) => {
  const { bool } = (await searchBody({}, 'objects')).query.function_score.query;
  t.plan(4);
  t.deepEqual(bool.must, { match_all: {} }, 'matches everything in the search space');
  t.deepEqual(
    bool.filter,
    { terms: { '@datatype.base': ['agent', 'archive', 'object', 'group'] } },
    'base-type filter kept'
  );
  t.deepEqual(bool.must_not, [SPH_EXCLUSION], 'must_not excludes SPH parts');
  t.notOk(bool.should || bool.minimum_should_match, 'no text clauses');
  t.end();
});

test(file + 'Random excludes SPH parts', async (t) => {
  const { bool } = (await searchBody({ random: 4 }, 'all')).query.function_score.query;
  t.plan(2);
  t.deepEqual(bool.must, { match_all: {} }, 'matches everything');
  t.deepEqual(bool.must_not, [SPH_EXCLUSION], 'must_not excludes SPH parts');
  t.end();
});

// With parts excluded, a query that only matches a part's title must still find
// the part's SPH parent through the child titles CIIM copies onto it.
const isPartTitleClause = (c) => !!(c.bool && c.bool.must &&
  c.bool.must.some(m => m.match_phrase && m.match_phrase['child.summary.title']));

test(file + 'Text query matches part titles on SPH parents only', async (t) => {
  const { should } = (await searchBody({ q: 'coley avenue' }, 'all')).query.function_score.query.bool;
  const clauses = should.filter(isPartTitleClause);
  t.plan(3);
  t.equal(clauses.length, 1, 'one part-title clause');
  t.deepEqual(clauses[0].bool.filter, [{ term: { '@datatype.grouping': 'SPH' } }], 'restricted to SPH parents');
  t.equal(clauses[0].bool.must[0].match_phrase['child.summary.title'].query, 'coley avenue', 'phrase is the query');
  t.end();
});

test(file + 'Browse (no q) has no part-title clause', async (t) => {
  const { bool } = (await searchBody({}, 'objects')).query.function_score.query;
  t.plan(1);
  t.notOk((bool.should || []).some(isPartTitleClause), 'no part-title clause');
  t.end();
});

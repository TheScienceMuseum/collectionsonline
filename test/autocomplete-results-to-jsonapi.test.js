const test = require('tape');
const sinon = require('sinon');
const autocomplete = require('../lib/autocomplete');
const autocompleteResultsToJsonApi = require('../lib/transforms/autocomplete-results-to-jsonapi');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

const config = { rootUrl: 'http://localhost:8000' };

// `_type` is the index mapping type, which is the same for every record.
const hit = (id, base, title) => ({
  _id: id,
  _type: 'data',
  _source: { '@datatype': { base }, summary: { title } }
});

test(file + 'Result type and self link come from @datatype.base, not _type', (t) => {
  const results = {
    body: {
      hits: {
        hits: [
          hit('co1', 'object', 'Placeholder object'),
          hit('cp1', 'agent', 'Placeholder person'),
          hit('aa1', 'archive', 'Placeholder archive'),
          hit('c1', 'group', 'Placeholder group')
        ]
      }
    }
  };
  const { data } = autocompleteResultsToJsonApi({ q: 'pla' }, results, config);
  t.plan(2);
  t.deepEqual(data.map(d => d.type), ['objects', 'people', 'documents', 'group']);
  t.deepEqual(data.map(d => d.links.self), [
    'http://localhost:8000/objects/co1',
    'http://localhost:8000/people/cp1',
    'http://localhost:8000/documents/aa1',
    'http://localhost:8000/group/c1'
  ]);
  t.end();
});

test(file + 'Typed autocomplete filters on the indexed @datatype.base value', async (t) => {
  const elastic = { search: sinon.stub().resolves({ body: { hits: { hits: [] } } }) };
  const expected = { objects: 'object', people: 'agent', documents: 'archive', group: 'group' };
  t.plan(Object.keys(expected).length);
  for (const [type, base] of Object.entries(expected)) {
    elastic.search.resetHistory();
    await autocomplete(elastic, { q: 'pla', type });
    const must = elastic.search.firstCall.args[0].body.query.function_score.query.bool.must;
    const typeTerm = must.find(clause => clause.term && clause.term['@datatype.base']);
    t.equal(typeTerm.term['@datatype.base'], base, `${type} -> ${base}`);
  }
  t.end();
});

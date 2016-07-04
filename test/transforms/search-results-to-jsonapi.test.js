const QueryString = require('querystring');
const test = require('tape');
const searchResultsToJsonApi = require('../../lib/transforms/search-results-to-jsonapi');
const queryParams = require('../../lib/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Should create valid meta count numbers', (t) => {
  t.plan(7);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 5,
      max_score: null,
      hits: [
        { _type: 'object', _id: `smg-object-${Date.now()}` }
      ]
    },
    aggregations: {
      total: { doc_count: 3554, total: { value: 3554 } },
      total_per_categories: {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'object', doc_count: 3304 },
          { key: 'agent', doc_count: 221 },
          { key: 'term', doc_count: 36 },
          { key: 'archive', doc_count: 29 },
          { key: 'place', doc_count: 7 }
        ]
      }
    }
  };

  var obj;
  var query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });
  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.meta.count.type.all, 3554, 'Total number of data is 3554');
  t.equal(obj.meta.count.type.people, 221, 'Total number of people is 221');
  t.equal(obj.meta.count.type.objects, 3304, 'Total number of people is 3304');
  t.equal(obj.meta.count.type.documents, 29, 'Total number of people is 29');
  t.notOk(obj.meta.count.type.term, 'The term count is excluded');
  t.notOk(obj.meta.count.type.place, 'The place count is excluded');
  t.end();
});

test(file + 'Should create valid meta default count numbers for empty aggregations', (t) => {
  t.plan(7);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 5,
      max_score: null,
      hits: [
        { _type: 'object', _id: `smg-object-${Date.now()}` }
      ]
    },
    aggregations: {
      total: { doc_count: 3554, total: { value: 3554 } },
      total_per_categories: {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: []
      }
    }
  };

  var obj;
  var query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.meta.count.type.all, 3554, 'Total number of data is 3554');
  t.equal(obj.meta.count.type.people, 0, 'Total number default value is 0 for people');
  t.equal(obj.meta.count.type.objects, 0, 'Total number default value is 0 for objects');
  t.equal(obj.meta.count.type.documents, 0, 'Total number of people is 29 for documents');
  t.notOk(obj.meta.count.type.term, 'The term count is excluded');
  t.notOk(obj.meta.count.type.place, 'The place count is excluded');
  t.end();
});

test(file + 'Should create valid links on first page', (t) => {
  t.plan(6);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 5,
      max_score: null,
      hits: [
        { _type: 'object', _id: `smg-object-${Date.now()}` }
      ]
    },
    aggregations: {
      total: { doc_count: 3554, total: { value: 3554 } },
      total_per_categories: {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'object', doc_count: 3304 },
          { key: 'agent', doc_count: 221 },
          { key: 'term', doc_count: 36 },
          { key: 'archive', doc_count: 29 },
          { key: 'place', doc_count: 7 }
        ]
      }
    }
  };

  var obj;
  var query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  var qs;

  qs = QueryString.stringify({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.self, '/search?' + qs, 'Self page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.first, '/search?' + qs, 'First page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.last, '/search?' + qs, 'Last page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 1, 'page[size]': 1 });
  t.equal(obj.links.next, '/search?' + qs, 'Next page link was correct');

  t.equal(obj.links.prev, null, 'Previous page link was correct');

  t.end();
});

test(file + 'Should create valid links on middle page', (t) => {
  t.plan(6);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 5,
      max_score: null,
      hits: [
        { _type: 'archive', _id: `smg-archive-${Date.now()}` }
      ]
    },
    aggregations: {
      total: { doc_count: 3554, total: { value: 3554 } },
      total_per_categories: {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'object', doc_count: 3304 },
          { key: 'agent', doc_count: 221 },
          { key: 'term', doc_count: 36 },
          { key: 'archive', doc_count: 29 },
          { key: 'place', doc_count: 7 }
        ]
      }
    }
  };

  var obj;
  var query = queryParams('html', { query: { q: 'test', 'page[number]': 1, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  var qs;

  qs = QueryString.stringify({ q: 'test', 'page[number]': 1, 'page[size]': 1 });
  t.equal(obj.links.self, '/search?' + qs, 'Self page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.first, '/search?' + qs, 'First page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.last, '/search?' + qs, 'Last page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 2, 'page[size]': 1 });
  t.equal(obj.links.next, '/search?' + qs, 'Next page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.prev, '/search?' + qs, 'Previous page link was correct');

  t.end();
});

test(file + 'Should create valid links on last page', (t) => {
  t.plan(6);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 5,
      max_score: null,
      hits: [
        { _type: 'agent', _id: `smg-agent-${Date.now()}` }
      ]
    },
    aggregations: {
      total: { doc_count: 3554, total: { value: 3554 } },
      total_per_categories: {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'object', doc_count: 3304 },
          { key: 'agent', doc_count: 221 },
          { key: 'term', doc_count: 36 },
          { key: 'archive', doc_count: 29 },
          { key: 'place', doc_count: 7 }
        ]
      }
    }
  };

  var obj;
  var query = queryParams('html', { query: { q: 'test', 'page[number]': 4, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  var qs;

  qs = QueryString.stringify({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.self, '/search?' + qs, 'Self page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.first, '/search?' + qs, 'First page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.last, '/search?' + qs, 'Last page link was correct');

  t.equal(obj.links.next, null, 'Next page link was correct');

  qs = QueryString.stringify({ q: 'test', 'page[number]': 3, 'page[size]': 1 });
  t.equal(obj.links.prev, '/search?' + qs, 'Previous page link was correct');

  t.end();
});

test(file + 'Should ignore unknown object types', (t) => {
  t.plan(3);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 1,
      max_score: null,
      hits: [{ _type: 'UNKNOWN', _id: 'ID' + Date.now() }]
    },
    aggregations: {
      total: { doc_count: 3554, total: { value: 3554 } },
      total_per_categories: {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'object', doc_count: 3304 },
          { key: 'agent', doc_count: 221 },
          { key: 'term', doc_count: 36 },
          { key: 'archive', doc_count: 29 },
          { key: 'place', doc_count: 7 }
        ]
      }
    }
  };

  var obj;
  var query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 50 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.data.length, 0, 'No objects were returned');
  t.equal(obj.meta.total_pages, 1, 'Total pages was correct');

  t.end();
});

test(file + 'Should extract @link\'d document to relationships and included', (t) => {
  t.plan(5);

  const relId = `smg-agent-${Date.now()}`;
  const relSummaryTitle = 'Charles Babbage';

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 5,
      max_score: null,
      hits: [
        {
          _type: 'object',
          _id: `smg-object-${Date.now()}`,
          _source: {
            agents: [
              {
                admin: { uid: relId },
                summary_title: relSummaryTitle
              }
            ]
          }
        }
      ]
    },
    aggregations: {
      total: { doc_count: 3554, total: { value: 3554 } },
      total_per_categories: {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'object', doc_count: 3304 },
          { key: 'agent', doc_count: 221 },
          { key: 'term', doc_count: 36 },
          { key: 'archive', doc_count: 29 },
          { key: 'place', doc_count: 7 }
        ]
      }
    }
  };

  var obj;
  var query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.data[0].relationships.people.data[0].type, 'people', 'Relationship type was correct');
  t.equal(obj.included[0].type, 'people', 'Included type was correct');
  t.equal(obj.included[0].id, relId.replace('agent', 'people'), 'Included ID was correct');
  t.equal(obj.included[0].attributes.summary_title, relSummaryTitle, 'Included summary_title was correct');

  t.end();
});

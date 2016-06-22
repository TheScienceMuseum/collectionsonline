const QueryString = require('querystring');
const test = require('tape');
const searchResultsToJsonApi = require('../../lib/transforms/search-results-to-jsonapi');

test('Should create valid links on first page', (t) => {
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
    }
  };

  let obj;

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi({ q: 'test', 'page[number]': 0, 'page[size]': 1 }, testResult);
  }, 'Transform did not throw');

  let qs;

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

test('Should create valid links on middle page', (t) => {
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
    }
  };

  let obj;

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi({ q: 'test', 'page[number]': 1, 'page[size]': 1 }, testResult);
  }, 'Transform did not throw');

  let qs;

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

test('Should create valid links on last page', (t) => {
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
    }
  };

  let obj;

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi({ q: 'test', 'page[number]': 4, 'page[size]': 1 }, testResult);
  }, 'Transform did not throw');

  let qs;

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

test('Should ignore unknown object types', (t) => {
  t.plan(3);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    hits: {
      total: 1,
      max_score: null,
      hits: [{ _type: 'UNKNOWN', _id: 'ID' + Date.now() }]
    }
  };

  let obj;

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi({ q: 'test', 'page[number]': 0, 'page[size]': 50 }, testResult);
  }, 'Transform did not throw');

  t.equal(obj.data.length, 0, 'No objects were returned');
  t.equal(obj.meta.total_pages, 1, 'Total pages was correct');

  t.end();
});

test('Should extract @link\'d document to relationships and included', (t) => {
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
    }
  };

  let obj;

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi({ q: 'test', 'page[number]': 0, 'page[size]': 1 }, testResult);
  }, 'Transform did not throw');

  t.equal(obj.data[0].relationships.people.data[0].type, 'people', 'Relationship type was correct');
  t.equal(obj.included[0].type, 'people', 'Included type was correct');
  t.equal(obj.included[0].id, relId.replace('agent', 'people'), 'Included ID was correct');
  t.equal(obj.included[0].attributes.summary_title, relSummaryTitle, 'Included summary_title was correct');

  t.end();
});

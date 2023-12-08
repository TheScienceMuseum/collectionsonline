const paramify = require('../../lib/helpers/paramify.js');
const querify = require('../../lib/helpers/querify.js');
const test = require('tape');
const searchResultsToJsonApi = require('../../lib/transforms/search-results-to-jsonapi');
const queryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const aggregationsAll = require('../helpers/aggregations-all.json');
const aggregationsPeople = require('../helpers/aggregations-all.json');
const aggregationsObjects = require('../helpers/aggregations-all.json');
const aggregationsDocuments = require('../helpers/aggregations-all.json');

const queryString = (params) => paramify(params) + querify(params);

test(file + 'Should create valid meta count numbers', (t) => {
  t.plan(7);
  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    body: {
      hits: {
        total: 3554,
        max_score: null,
        hits: [
          {
            _id: `smg-object-${Date.now()}`,
            _source: {
              '@datatype': {
                base: 'object'
              },
              summary: {
                title: 'this is the summary title'
              }
            }
          }
        ]
      },
      aggregations: {
        total_categories: {
          doc_count: 17,
          documents: { doc_count: 0, documents_total: [{ value: 29 }] },
          objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
          people: { doc_count: 4, people_total: [{ value: 221 }] },
          all: {
            doc_count: 17,
            all_total: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [{ key: 'object', doc_count: 13 }, { key: 'agent', doc_count: 4 }]
            }
          }
        }
      }
    }
  };

  testResult.body.aggregations.all = aggregationsAll;
  testResult.body.aggregations.people = aggregationsPeople;
  testResult.body.aggregations.objects = aggregationsObjects;
  testResult.body.aggregations.documents = aggregationsDocuments;

  let obj;
  const query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });
  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.meta.count.type.all, 17, 'Total number of data is 17');
  t.equal(obj.meta.count.type.people, 4, 'Total number of people is 4');
  t.equal(obj.meta.count.type.objects, 13, 'Total number of people is 13');
  t.equal(obj.meta.count.type.documents, 0, 'Total number of people is 0');
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
    body: {
      hits: {
        total: 3554,
        max_score: null,
        hits: [
          {
            _id: `smg-object-${Date.now()}`,
            _source: {
              '@datatype': {
                base: 'object'
              },
              summary: {
                title: 'this is the summary title'
              }
            }
          }
        ]
      },
      aggregations: {
        total_categories: {
          doc_count: 17,
          documents: { doc_count: 0, documents_total: [{ value: 29 }] },
          objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
          people: { doc_count: 4, people_total: [{ value: 221 }] },
          all: {
            doc_count: 17,
            all_total: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: []
            }
          }
        }
      }
    }
  };

  testResult.body.aggregations.all = aggregationsAll;
  testResult.body.aggregations.people = aggregationsPeople;
  testResult.body.aggregations.objects = aggregationsObjects;
  testResult.body.aggregations.documents = aggregationsDocuments;

  let obj;
  const query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.meta.count.type.all, 17, 'Total number of data is 3554');
  t.equal(obj.meta.count.type.people, 0, 'Total number default value is 0 for people');
  t.equal(obj.meta.count.type.objects, 0, 'Total number default value is 0 for objects');
  t.equal(obj.meta.count.type.documents, 0, 'Total number of people is 0 for documents');
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
    body: {
      hits: {
        total: 5,
        max_score: null,
        hits: [
          {
            _id: `smg-object-${Date.now()}`,
            _source: {
              '@datatype': {
                base: 'object'
              },
              summary: {
                title: 'this is the summary title'
              }
            }
          }
        ]
      },
      aggregations: {
        total_categories: {
          doc_count: 17,
          documents: { doc_count: 0, documents_total: [{ value: 29 }] },
          objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
          people: { doc_count: 4, people_total: [{ value: 221 }] },
          all: {
            doc_count: 17,
            all_total: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [{ key: 'object', doc_count: 13 }, { key: 'agent', doc_count: 4 }]
            }
          }
        }
      }
    }
  };

  testResult.body.aggregations.all = aggregationsAll;
  testResult.body.aggregations.people = aggregationsPeople;
  testResult.body.aggregations.objects = aggregationsObjects;
  testResult.body.aggregations.documents = aggregationsDocuments;

  let obj;
  const query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  let qs;

  qs = queryString({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.self, '/search' + qs, 'Self page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.first, '/search' + qs, 'First page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.last, '/search' + qs, 'Last page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 1, 'page[size]': 1 });
  t.equal(obj.links.next, '/search' + qs, 'Next page link was correct');

  t.equal(obj.links.prev, null, 'Previous page link was correct');

  t.end();
});

test(file + 'Should create valid links on middle page', (t) => {
  t.plan(6);
  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    body: {
      hits: {
        total: 5,
        max_score: null,
        hits: [
          {
            _id: `smg-object-${Date.now()}`,
            _source: {
              '@datatype': {
                base: 'object'
              },
              summary: {
                title: 'this is the summary title'
              }
            }
          }
        ]
      },
      aggregations: {
        total_categories: {
          doc_count: 17,
          documents: { doc_count: 0, documents_total: [{ value: 29 }] },
          objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
          people: { doc_count: 4, people_total: [{ value: 221 }] },
          all: {
            doc_count: 17,
            all_total: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [{ key: 'object', doc_count: 13 }, { key: 'agent', doc_count: 4 }]
            }
          }
        }
      }
    }
  };
  testResult.body.aggregations.all = aggregationsAll;
  testResult.body.aggregations.people = aggregationsPeople;
  testResult.body.aggregations.objects = aggregationsObjects;
  testResult.body.aggregations.documents = aggregationsDocuments;

  let obj;
  const query = queryParams('html', { query: { q: 'test', 'page[number]': 1, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  let qs;

  qs = queryString({ q: 'test', 'page[number]': 1, 'page[size]': 1 });
  t.equal(obj.links.self, '/search' + qs, 'Self page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.first, '/search' + qs, 'First page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.last, '/search' + qs, 'Last page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 2, 'page[size]': 1 });
  t.equal(obj.links.next, '/search' + qs, 'Next page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.prev, '/search' + qs, 'Previous page link was correct');

  t.end();
});

test(file + 'Should create valid links on last page', (t) => {
  t.plan(6);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    body: {
      hits: {
        total: 5,
        max_score: null,
        hits: [
          {
            _id: `smg-object-${Date.now()}`,
            _source: {
              '@datatype': {
                base: 'object'
              },
              summary: {
                title: 'this is the summary title'
              }
            }
          }
        ]
      },
      aggregations: {
        total_categories: {
          doc_count: 17,
          documents: { doc_count: 0, documents_total: [{ value: 29 }] },
          objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
          people: { doc_count: 4, people_total: [{ value: 221 }] },
          all: {
            doc_count: 17,
            all_total: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [{ key: 'object', doc_count: 13 }, { key: 'agent', doc_count: 4 }]
            }
          }
        }
      }
    }
  };

  testResult.body.aggregations.all = aggregationsAll;
  testResult.body.aggregations.people = aggregationsPeople;
  testResult.body.aggregations.objects = aggregationsObjects;
  testResult.body.aggregations.documents = aggregationsDocuments;

  let obj;
  const query = queryParams('html', { query: { q: 'test', 'page[number]': 4, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  let qs;

  qs = queryString({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.self, '/search' + qs, 'Self page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 0, 'page[size]': 1 });
  t.equal(obj.links.first, '/search' + qs, 'First page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 4, 'page[size]': 1 });
  t.equal(obj.links.last, '/search' + qs, 'Last page link was correct');

  t.equal(obj.links.next, null, 'Next page link was correct');

  qs = queryString({ q: 'test', 'page[number]': 3, 'page[size]': 1 });
  t.equal(obj.links.prev, '/search' + qs, 'Previous page link was correct');

  t.end();
});

test(file + 'Should ignore unknown object types', (t) => {
  t.plan(3);

  const testResult = {
    took: 0,
    timed_out: false,
    _shards: { total: 1, successful: 1, failed: 0 },
    body: {
      hits: {
        total: 5,
        max_score: null,
        hits: [
          {
            _id: `smg-object-${Date.now()}`,
            _source: {
              '@datatype': {
                base: 'wrongtype'
              },
              summary: {
                title: 'this is the summary title'
              }
            }
          }
        ]
      },
      aggregations: {
        total_categories: {
          doc_count: 17,
          documents: { doc_count: 0, documents_total: [{ value: 29 }] },
          objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
          people: { doc_count: 4, people_total: [{ value: 221 }] },
          all: {
            doc_count: 17,
            all_total: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [{ key: 'object', doc_count: 13 }, { key: 'agent', doc_count: 4 }]
            }
          }
        }
      }
    }
  };

  testResult.body.aggregations.all = aggregationsAll;
  testResult.body.aggregations.people = aggregationsPeople;
  testResult.body.aggregations.objects = aggregationsObjects;
  testResult.body.aggregations.documents = aggregationsDocuments;

  let obj;
  const query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 50 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.data.length, 0, 'No objects were returned');
  t.equal(obj.meta.total_pages, 0, 'Total pages was correct');

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
    body: {
      hits: {
        total: 5,
        max_score: null,
        hits: [
          {
            _id: `smg-object-${Date.now()}`,
            _source: {
              '@datatype': {
                base: 'object'
              },
              summary: {
                title: 'this is the summary title'
              },
              agent: [
                {
                  '@admin': { uid: relId },
                  summary: {
                    title: relSummaryTitle
                  }
                }
              ]
            }
          }
        ]
      },
      aggregations: {
        total_categories: {
          doc_count: 17,
          documents: { doc_count: 0, documents_total: [{ value: 29 }] },
          objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
          people: { doc_count: 4, people_total: [{ value: 221 }] },
          all: {
            doc_count: 17,
            all_total: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [{ key: 'object', doc_count: 13 }, { key: 'agent', doc_count: 4 }]
            }
          }
        }
      }
    }
  };

  testResult.body.aggregations.all = aggregationsAll;
  testResult.body.aggregations.people = aggregationsPeople;
  testResult.body.aggregations.objects = aggregationsObjects;
  testResult.body.aggregations.documents = aggregationsDocuments;

  let obj;
  const query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });

  t.doesNotThrow(() => {
    obj = searchResultsToJsonApi(query, testResult);
  }, 'Transform did not throw');

  t.equal(obj.data[0].relationships.people.data[0].type, 'people', 'Relationship type was correct');
  t.equal(obj.included[0].type, 'people', 'Included type was correct');
  t.equal(obj.included[0].id, relId.replace('agent', 'people'), 'Included ID was correct');
  t.equal(obj.included[0].attributes.summary_title, relSummaryTitle, 'Included summary_title was correct');

  t.end();
});

/**
 * Archive records' `web` field can hold internal file-share locations rather
 * than public URLs, so it must never be serialised into JSON search results.
 * The record API equivalent is covered by test/jsonapi-response-web-attribute.test.js.
 * https://github.com/TheScienceMuseum/collectionsonline/issues/2241
 */
const test = require('tape');
const config = require('../../config');
const searchResultsToJsonApi = require('../../lib/transforms/search-results-to-jsonapi');
const queryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const aggregations = require('../helpers/aggregations-all.json');

const UNC_PATH = '\\\\fileserver\\share\\aid.pdf';
const PUBLIC_URL = 'https://example.org/finding-aid.pdf';

test(file + 'Search results response omits archive web values', function (t) {
  const results = {
    body: {
      hits: {
        total: { value: 1 },
        hits: [{
          _id: 'aa0000001',
          _source: {
            '@admin': { uid: 'aa0000001', id: 'archive-aa0000001' },
            '@datatype': { base: 'archive' },
            summary: { title: 'Test fonds' },
            title: [{ value: 'Test fonds', primary: true }],
            level: { value: 'fonds' },
            web: [{ value: UNC_PATH }, { value: PUBLIC_URL }]
          }
        }]
      },
      aggregations: {
        total_categories: {
          all: {
            doc_count: 1,
            all_total: { buckets: [{ key: 'archive', doc_count: 1 }] }
          }
        },
        all: aggregations
      }
    }
  };
  const query = queryParams('json', {
    query: { q: 'fonds', 'page[number]': 0, 'page[size]': 1 },
    params: {}
  });
  const response = searchResultsToJsonApi(query, results, config);
  const json = JSON.stringify(response);

  t.equal(response.data.length, 1, 'archive hit is serialised');
  t.equal(response.data[0].type, 'documents', 'hit is serialised as a document');
  t.equal(response.data[0].attributes.summary.title, 'Test fonds', 'whitelisted attributes still pass through');
  t.notOk('web' in response.data[0].attributes, 'web attribute is not exposed');
  t.notOk(json.includes('fileserver'), 'file-share path does not appear anywhere in the response');
  t.notOk(json.includes(PUBLIC_URL), 'web URLs do not appear anywhere in the response');
  t.end();
});

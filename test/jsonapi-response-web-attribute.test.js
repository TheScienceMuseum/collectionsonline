const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

// Minimal archive document. The `web` value is a placeholder: on real archive
// records this field holds internal file locations, which must never be
// returned by the API (#2241).
const archiveDoc = {
  _id: 'aa000000001',
  _source: {
    '@admin': { uid: 'aa000000001' },
    '@datatype': { base: 'archive' },
    summary: { title: 'Placeholder archive record' },
    web: [{ type: 'placeholder', value: 'not-a-public-value' }]
  }
};

test(file + 'Archive `web` attribute is not exposed in the JSON API', (t) => {
  t.plan(2);
  const response = buildJSONResponse(archiveDoc, config);
  t.equal(response.data.type, 'documents', 'built a documents response');
  t.notOk('web' in response.data.attributes, 'web attribute omitted');
  t.end();
});

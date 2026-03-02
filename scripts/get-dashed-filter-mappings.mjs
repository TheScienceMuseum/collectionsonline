import { Client } from '@elastic/elasticsearch';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const config = require('../config');
const path = require('path');
const fs = require('fs');
const dashToSpace = require('../lib/helpers/dash-to-space');

const elastic = new Client(config.elasticsearch);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, '/../fixtures/dashed-filter-mappings.json');

const fields = [
  { esField: 'category.name.keyword', filterType: 'categories' },
  { esField: 'name.value.keyword', filterType: 'object_type' },
  { esField: 'material.value.keyword', filterType: 'material' },
  { esField: 'occupation.value.keyword', filterType: 'occupation' },
  { esField: 'creation.place.summary.title.lower', filterType: 'places' },
  { esField: 'birth.place.name.value.lower', filterType: 'birth_place' },
  { esField: 'creation.maker.summary.title.lower', filterType: 'makers' },
  { esField: 'fonds.summary.title.lower', filterType: 'archive' },
  { esField: 'cumulation.collector.summary.title.lower', filterType: 'collection' }
];

async function run () {
  const existing = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  for (const { esField, filterType } of fields) {
    const result = await elastic.search({
      index: 'ciim',
      body: {
        size: 0,
        aggs: {
          values: {
            terms: { field: esField, size: 1000 }
          }
        }
      }
    });

    for (const bucket of result.body.aggregations.values.buckets) {
      const key = dashToSpace(bucket.key.toLowerCase());
      if (bucket.key.includes('-') && !existing[filterType][key]) {
        existing[filterType][key] = bucket.key;
      }
    }
  }

  fs.writeFileSync(fixturePath, JSON.stringify(existing, null, 2));
  console.log('Written fixtures/dashed-filter-mappings.json');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

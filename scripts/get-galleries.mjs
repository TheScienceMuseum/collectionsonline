import { Client } from '@elastic/elasticsearch';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const config = require('../config');
const path = require('path');
const fs = require('fs');

// Resolve __dirname before using it (ESM doesn't provide it natively)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, '/../fixtures/galleries.json');

const elastic = new Client(config.elasticsearch);

const body = {
  query: {
    exists: { field: 'ondisplay.value' }
  }
};

const searchOpts = {
  index: 'ciim',
  body,
  scroll: '30s'
};

const allGalleries = [];

console.log('Fetching gallery data...');

elastic.search(searchOpts, function getMoreUntilDone (err, result) {
  if (err) console.log('error in get galleries: ' + err);
  else {
    let galName;
    let musName;
    result.body.hits.hits.forEach(function (hit, i) {
      galName = hit._source.ondisplay.find(e => e.type === 'gallery');
      musName = hit._source.ondisplay.find(e => e.type === 'museum');
      if (galName && musName) {
        allGalleries.push({ gallery: galName.value, museum: musName.value });
      } else {
        allGalleries.push(false);
      }
    });

    console.log(`  Fetched ${allGalleries.length} of ${result.body.hits.total.value} records...`);

    if (result.body.hits.total.value !== allGalleries.length) {
      elastic.scroll({
        scrollId: result.body._scroll_id,
        scroll: '30s'
      }, getMoreUntilDone);
    } else {
      const galleries = allGalleries.filter(Boolean);
      const gal = {};

      galleries.forEach(e => {
        if (!gal[e.gallery]) {
          gal[e.gallery] = e.museum;
        }
      });

      fs.writeFileSync(fixturePath, JSON.stringify(gal));
      console.log(`Found ${Object.keys(gal).length} unique galleries. Written fixtures/galleries.json`);
    }
  }
});

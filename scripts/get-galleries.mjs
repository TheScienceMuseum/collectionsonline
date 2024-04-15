import { Client } from '@elastic/elasticsearch';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const config = require('../config');
const elastic = new Client(config.elasticsearch);
const path = require('path');
const fs = require('fs');

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

elastic.search(searchOpts, function getMoreUntilDone (err, result) {
  if (err) console.log(err);
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

    if (result.body.hits.total.value !== allGalleries.length) {
      console.log(result.body.hits.total.value);
      console.log(allGalleries.length);
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

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      fs.writeFileSync(path.join(__dirname, '/../fixtures/galleries.json'), JSON.stringify(gal));
    }
  }
});

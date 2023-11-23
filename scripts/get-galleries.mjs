import { Client } from '@elastic/elasticsearch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const config = require('../config');
const elastic = new Client(config.elasticsearch);
const path = require('path');
const fs = require('fs');

const body = {
  query: {
    exists: { field: 'locations.name' }
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
      galName = hit._source.locations[0].name.find(e => e.type === 'gallery');
      musName = hit._source.locations[0].name.find(e => e.type === 'museum');
      if (galName && musName) {
        allGalleries.push({ gallery: galName.value, museum: musName.value });
      } else {
        allGalleries.push(false);
      }
    });

    if (result.body.hits.total !== allGalleries.length) {
      elastic.scroll({
        scrollId: result._scroll_id,
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

      fs.writeFileSync(path.join(__dirname, '/../fixtures/galleries.json'), JSON.stringify(gal));
    }
  }
});

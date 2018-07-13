const fs = require('fs');
const Client = require('elasticsearch').Client;
const config = require('../config');
const elastic = new Client(config.elasticsearch);
const path = require('path');

const body = {
  'query': {
    'exists': { 'field': 'locations.name' }
  }
};

const searchOpts = {
  index: 'smg',
  body: body,
  scroll: '30s'
};

var allGalleries = [];

elastic.search(searchOpts, function getMoreUntilDone (err, result) {
  if (err) console.log(err);
  else {
    var galName;
    var musName;
    result.hits.hits.forEach(function (hit, i) {
      galName = hit._source.locations[0].name.find(e => e.type === 'gallery');
      musName = hit._source.locations[0].name.find(e => e.type === 'museum');
      if (galName && musName) {
        if (musName.value === 'National Media Museum') { musName.value = 'National Science and Media Museum'; }
        allGalleries.push({gallery: galName.value, museum: musName.value});
      } else {
        allGalleries.push(false);
      }
    });

    if (result.hits.total !== allGalleries.length) {
      elastic.scroll({
        scrollId: result._scroll_id,
        scroll: '30s'
      }, getMoreUntilDone);
    } else {
      var galleries = allGalleries.filter(Boolean);
      var gal = {};

      galleries.forEach(e => {
        if (!gal[e.gallery]) {
          gal[e.gallery] = e.museum;
        }
      });

      fs.writeFileSync(path.join(__dirname, '/../fixtures/galleries.json'), JSON.stringify(gal));
    }
  }
});

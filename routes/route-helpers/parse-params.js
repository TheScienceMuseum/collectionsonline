const museumMap = require('../../lib/museum-mapping');
const utils = require('../../lib/helpers/utils');

module.exports = function (urlParams) {
  var params = {};
  var categories = {};
  if (urlParams.filters) {
    var urlCats = urlParams.filters.split('/');
    if (urlCats[0] === 'objects' || urlCats[0] === 'people' || urlCats[0] === 'documents') {
      params.type = urlCats[0];
      urlCats.shift();
    } else {
      params.type = 'all';
    }
    urlCats.forEach((e, i) => {
      if (i % 2 === 0) {
        if (e === 'has_image' || e === 'images') {
          urlCats.splice(i + 1, 0, 'true');
          e = 'has_image';
        }
        if (e === 'category' || e === 'category') {
          e = 'categories';
        }
        if (urlCats[i] !== 'search') {
          categories[e] = urlCats[i + 1];
        }
      }
    });
  }

  for (var cat in categories) {
    if (cat === 'museum') {
      categories[cat] = museumMap.toLong(categories[cat]);
    } else if (cat !== 'has_image') {
      categories[cat] = categories[cat];
    }
  }

  return {params, categories};
};

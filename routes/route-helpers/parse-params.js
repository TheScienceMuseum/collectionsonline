const museumMap = require('../../lib/museum-mapping');
const utils = require('../../lib/helpers/utils');

module.exports = function (urlParams) {
  var params = {};
  var categories = {};
  if (urlParams.filters) {
    var urlCats = urlParams.filters.split('/').filter(function (el) {
      if (el === 'objects' || el === 'people' || el === 'documents') {
        params.type = el;
        return false;
      } else {
        return true
      }
    });
    if (!params.type) {
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

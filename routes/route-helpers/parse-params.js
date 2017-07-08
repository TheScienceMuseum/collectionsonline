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
        return true;
      }
    });
    if (!params.type) {
      params.type = 'all';
    }
    for (var i = 0; i < urlCats.length; i++) {
      if (urlCats[i] === 'has_image' || urlCats[i] === 'images') {
        urlCats.splice(i + 1, 0, 'true');
        categories['has_image'] = 'has_image';
      } else if (urlCats[i] === 'image_license') {
        urlCats.splice(i + 1, 0, 'true');
        categories['image_license'] = 'image_license';
      } else if (i % 2 === 0) {
        if (urlCats[i] === 'category') {
          urlCats[i] = 'categories';
        }
        if (urlCats[i + 1] && urlCats[i + 1].indexOf('+') > -1) {
          categories[urlCats[i]] = urlCats[i + 1].split('+');
        } else if (urlCats[i] !== 'search') {
          categories[urlCats[i]] = urlCats[i + 1];
        }
      }
    }
  }

  for (var cat in categories) {
    var exclude = ['has_image', 'object_type', 'material', 'occupation'];

    if (cat === 'museum') {
      categories[cat] = museumMap.toLong(categories[cat]);
    } else if (exclude.indexOf(cat) === -1) {
      categories[cat] = utils.uppercaseFirstChar(categories[cat]);
    }
  }

  return {params, categories};
};

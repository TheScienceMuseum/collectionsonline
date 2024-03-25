const museumMap = require('../../lib/museum-mapping');
const utils = require('../../lib/helpers/utils');

module.exports = function (urlParams) {
  const params = {};
  const categories = {};
  if (urlParams.filters) {
    const urlCats = urlParams.filters.split('/').filter(function (el) {
      if (
        el === 'objects' ||
        el === 'people' ||
        el === 'documents' ||
        el === 'group'
      ) {
        params.type = el;
        return false;
      } else {
        return true;
      }
    });
    if (!params.type) {
      params.type = 'all';
    }
    for (let i = 0; i < urlCats.length; i++) {
      if (urlCats[i] === 'has_image' || urlCats[i] === 'images') {
        urlCats.splice(i + 1, 0, 'true');
        categories.has_image = 'has_image';
      } else if (urlCats[i] === 'image_license') {
        urlCats.splice(i + 1, 0, 'true');
        categories.image_license = 'image_license';
      } else if (urlCats[i] === 'rotational') {
        urlCats.splice(i + 1, 0, 'true');
        categories.rotational = 'rotational';
      } else if (i % 2 === 0) {
        if (urlCats[i] === 'category') {
          urlCats[i] = 'categories';
        }
        if (urlCats[i + 1] && urlCats[i + 1].indexOf('-') > -1) {
          categories[urlCats[i]] = urlCats[i + 1].split('-').join(' ');
        }
        if (urlCats[i + 1] && urlCats[i + 1].indexOf('+') > -1) {
          categories[urlCats[i]] = urlCats[i + 1].split('+');
        } else if (urlCats[i] !== 'search') {
          categories[urlCats[i]] = urlCats[i + 1];
        }
      }
    }
  }

  for (const cat in categories) {
    const exclude = [
      'has_image',
      'object_type',
      'material',
      'occupation',
      'mphc'
    ];

    if (cat === 'museum') {
      categories[cat] = museumMap.toLong(categories[cat]);
    } else if (exclude.indexOf(cat) === -1) {
      categories[cat] = utils.uppercaseFirstChar(categories[cat]);
    }
  }
  return { params, categories };
};

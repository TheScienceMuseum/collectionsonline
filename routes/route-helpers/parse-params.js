const museumMap = require('../../lib/museum-mapping');

module.exports = function (urlParams) {
  var params = {};
  var categories = {};
  if (urlParams.cat) {
    var urlCats = urlParams.cat.split('/');
    if (urlCats[0] === 'objects' || urlCats[0] === 'people' || urlCats[0] === 'documents') {
      params.type = urlCats[0];
      urlCats.shift();
    } else {
      params.type = 'all';
    }
    urlCats.forEach((e, i) => {
      if (i % 2 === 0) {
        if (e === 'has_image') {
          urlCats.splice(i + 1, 0, 'true');
        }
        categories[e] = urlCats[i + 1];
      }
    });
  }

  for (var cat in categories) {
    if (cat === 'museum') {
      categories[cat] = uppercaseFirstChar(museumMap.toLong(categories[cat]));
    } else if (cat !== 'has_image') {
      categories[cat] = uppercaseFirstChar(categories[cat]);
    }
  }

  return {params, categories};
};

function uppercaseFirstChar (str) {
  if (!str) return false;
  return str.split(' ').map(e => e[0].toUpperCase() + e.substring(1)).join(' ');
}

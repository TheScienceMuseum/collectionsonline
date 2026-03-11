const removeFilter = require('./remove-filter-string.js');
const encodeFilterValue = require('./encode-filter-value.js');

// Creates Parameter String, excluding queries
module.exports = function paramify (q) {
  let paramString = '';
  const exclude = ['q', 'page[size]', 'page[type]', 'type', 'page[number]', 'page[sort]'];

  Object.keys(q).forEach(function (el) {
    if (el && exclude.indexOf(el) === -1) {
      if (el === 'filter[has_image]' || el === 'has_image') {
        paramString += '/' + 'images';
      } else if (el === 'filter[image_license]' || el === 'image_license') {
        paramString += '/' + 'image_license';
      } else if (el === 'filter[rotational]' || el === 'rotational') {
        paramString += '/' + 'rotational';
      } else if (typeof q[el] === 'object') {
        paramString += '/' + removeFilter(el) + '/' + q[el].reduce((acc, b, i) => {
          return acc + (i !== 0 ? '+' : '') + encodeFilterValue(b);
        }, '');
      } else {
        paramString += '/' + removeFilter(el) + '/' + encodeFilterValue(String(q[el]));
      }
    }
  });

  return paramString.replace('?', '%3F');
};

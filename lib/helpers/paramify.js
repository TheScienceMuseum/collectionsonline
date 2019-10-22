var removeFilter = require('./remove-filter-string.js');

// Creates Parameter String, excluding queries
module.exports = function paramify (q) {
  var paramString = '';
  var exclude = ['q', 'page[size]', 'page[type]', 'type', 'page[number]', 'page[sort]'];

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
          return acc + (i !== 0 ? '+' : '') + b.split(' ').join('-');
        }, '');
      } else {
        paramString += '/' + removeFilter(el) + '/' + q[el];
      }
    }
  });

  return paramString.replace('?', '%3F').toLowerCase();
};

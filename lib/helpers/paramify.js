var removeFilter = require('./remove-filter-string.js');

// Creates Parameter String, excluding queries
module.exports = function paramify (q) {
  var paramString = '';
  var query;
  var exclude = ['q', 'page[size]', 'page[type]', 'type', 'page[number]']
  Object.keys(q).forEach(function (el) {
    if (el && exclude.indexOf(el) === -1) {
      if (el === 'filter[has_image]' || el === 'has_image') {
        paramString += '/' + 'images';
      } else if (el === 'filter[image_license]' || el === 'image_license') {
        paramString += '/' + 'image_license';
      } else {
        paramString += '/' + removeFilter(el) + '/' + q[el];
      }
    }
  });

  return paramString;
}

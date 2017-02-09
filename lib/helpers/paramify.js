var removeFilter = require('./remove-filter-string.js');

// Creates Parameter String, excluding queries
module.exports = function paramify (q) {
  var paramString = '';
  var query;
  Object.keys(q).forEach(function (el) {
    if (el && el !== 'q' && el !== 'page[size]' && el !== 'page[type]' && el !== 'type') {
      if (el === 'filter[has_image]' || el === 'has_image') {
        paramString += '/' + 'images';
      } else {
        paramString += '/' + removeFilter(el) + '/' + q[el];
      }
    }
  });

  return paramString;
}

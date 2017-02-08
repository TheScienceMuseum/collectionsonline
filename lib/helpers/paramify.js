var removeFilter = require('./remove-filter-string.js');

module.exports = function paramify (q) {
  var paramString = '';
  var query;
  Object.keys(q).forEach(function (el) {
      if (el && el !== 'q') {
        if (el === 'filter[has_image]' || el === 'has_image') {
          paramString += '/' + 'images';
        } else {
          paramString += '/' + removeFilter(el) + '/' + q[el];
        }
      } else if (el === 'q') {
        query = q[el];
      }
  });
  return query ? paramString + '?q=' + query : paramString;
}

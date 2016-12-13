'use strict';

module.exports = function getPrimaryValue (array) {
  var primary;

  if (Object.prototype.toString.call(array) === '[object String]') {
    return array;
  }

  if (!Array.isArray(array) || !array.length) {
    return null;
  }

  primary = array.filter(function (d) {
    return d.primary;
  }).map(function (d) {
    return d.value;
  })[0];

  return primary || array[0].value;
};

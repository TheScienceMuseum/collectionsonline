'use strict';

function getFirst (arr) {
  if (!arr[0]) {
    return null;
  }
  return arr[0].type !== 'note'
       ? arr[0].value
       : ((arr[1] || {}).value || null);
}

module.exports = function getPrimaryValue (array) {
  var primary;

  if (Object.prototype.toString.call(array) === '[object String]') {
    return array;
  }

  if (!Array.isArray(array) || !array.length) {
    return null;
  }

  primary = array.filter(function (d) {
    return d.primary && d.type !== 'note';
  }).map(function (d) {
    return d.value;
  })[0];

  return primary || getFirst(array);
};

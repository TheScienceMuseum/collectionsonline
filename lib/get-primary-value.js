'use strict';

const getFirst = require('./get-first.js');

module.exports = function getPrimaryValue (array) {
  if (Object.prototype.toString.call(array) === '[object String]') {
    return array;
  }

  if (!Array.isArray(array) || !array.length) {
    return null;
  }

  const primary = array.filter(function (d) {
    if (d.type === 'biography') return d.value; // treat biography as primary description of people records
    return d.primary && d.type !== 'note';
  }).map(function (d) {
    return d.value;
  })[0];

  return primary || getFirst(array);
};

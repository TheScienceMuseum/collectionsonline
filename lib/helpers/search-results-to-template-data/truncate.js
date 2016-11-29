'use strict';

/**
* Truncate value when lenght is > than maxChar
*/

module.exports = function (value, maxChar) {
  return value.length <= maxChar
    ? value
    : value.slice(0, maxChar) + '...';
};

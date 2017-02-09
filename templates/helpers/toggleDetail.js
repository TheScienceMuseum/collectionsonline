'use strict';

module.exports = function (item, options) {
  var toggleFor = ['SYSTEM OF ARRANGEMENT', 'COPYRIGHT', 'HISTORY NOTE'];

  if (toggleFor.indexOf(item.key.toUpperCase()) > -1) {
    return options.fn(item);
  }

  return options.inverse(item);
};

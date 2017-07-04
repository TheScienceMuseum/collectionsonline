'use strict';

module.exports = function (key, options) {
  var toggleFor = ['SYSTEM OF ARRANGEMENT', 'COPYRIGHT', 'HISTORY NOTE'];

  return toggleFor.indexOf(key.toUpperCase()) > -1 && options.data.root.page !== 'object';
};

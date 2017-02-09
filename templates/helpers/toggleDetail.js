'use strict';

module.exports = function (key) {
  var toggleFor = ['SYSTEM OF ARRANGEMENT', 'COPYRIGHT', 'HISTORY NOTE'];

  return toggleFor.indexOf(key.toUpperCase()) > -1;
};

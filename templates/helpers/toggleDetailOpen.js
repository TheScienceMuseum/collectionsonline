'use strict';

module.exports = function (key, options) {
  var toggleFor = ['TRANSCRIPTION'];

  return toggleFor.indexOf(key.toUpperCase()) > -1 && options.data.root.page !== 'object';
};
'use strict';

module.exports = function (key, options) {
  var toggleFor = ['TRANSCRIPTION'];
  console.log("***" + options.data.root.page);
  return toggleFor.indexOf(key.toUpperCase()) > -1 && options.data.root.page === 'archive';
};

'use strict';

module.exports = function (key, options) {
  const toggleFor = ['TRANSCRIPTION'];
  return toggleFor.indexOf(key.toUpperCase()) > -1 && options.data.root.page === 'archive' ? 'open' : null;
};

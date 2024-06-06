'use strict';

module.exports = function (key, options) {
  return (['SYSTEM OF ARRANGEMENT', 'COPYRIGHT', 'HISTORY NOTE'].indexOf(key.toUpperCase()) > -1 && options.data.root.page !== 'object') ||
  (
    ['TRANSCRIPTION'].indexOf(key.toUpperCase()) > -1 && options.data.root.page === 'archive'
  );
};

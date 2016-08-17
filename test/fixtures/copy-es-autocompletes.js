const Async = require('async');
const autocomplete = require('../../lib/autocomplete');

module.exports = (elastic, autocompletes, database, cb) => {
  database.autocompletes = database.autocompletes || {};

  Async.each(autocompletes, (data, cb) => {
    autocomplete(elastic, data, (err, results) => {
      database.autocompletes[data.q] = { error: err, response: results };
      cb();
    });
  }, cb);
};

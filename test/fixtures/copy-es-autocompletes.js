const autocomplete = require('../../lib/autocomplete');

module.exports = (elastic, autocompletes, database, cb) => {
  database.autocompletes = database.autocompletes || {};
  let count = 0;
  autocompletes.forEach(async data => {
    let results;
    let err;

    try {
      results = await autocomplete(elastic, data);
    } catch (e) {
      err = e;
    }

    database.autocompletes[data.q] = { error: err, response: results };
    count += 1;

    if (count === autocompletes.length) {
      return cb();
    }
  });
};

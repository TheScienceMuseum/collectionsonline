// Create a mock elasticsearch client with noop functions
const database = require('../fixtures/elastic-responses/database.json');
module.exports = () => ({
  search: function () {
    const cb = arguments[arguments.length - 1];
    const q = arguments[0].body.query.multi_match.query;
    if (database.search[q]) {
      const search = database.search[q];
      return cb(search.error, search.response);
    } else {
      console.log('search fixture not found for', q);
    }
  },

  get: function () {
    const cb = arguments[arguments.length - 1];
    const type = arguments[0].type;
    const id = arguments[0].id;
    const data = database[type][id];
    cb(data.error, data.response);
  }
});

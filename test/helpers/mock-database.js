// Create a mock elasticsearch client with noop functions
const database = require('../fixtures/elastic-responses/database.json');
const getNestedProperty = require('../../lib/nested-property');

module.exports = () => ({
  search: function () {
    var q;
    var search;
    const cb = arguments[arguments.length - 1];

    if (arguments[0].body.query.multi_match) {
      q = arguments[0].body.query.multi_match.query;
    } else if (getNestedProperty(arguments, '0.body.query.filtered.filter.bool.should')) {
      q = arguments[0].body.query.filtered.filter.bool.should[1].term['agents.admin.uid'];
    } else if (getNestedProperty(arguments, '0.body.query.filtered.filter.bool.must')) {
      q = arguments[0].body.query.filtered.filter.bool.must.term['parent.admin.uid'];
    }

    if (database.search[q]) {
      search = database.search[q];
      return cb(search.error, search.response);
    } else if (database.related[q]) {
      search = database.related[q];
      return cb(search.error, search.response);
    } else if (database.children[q]) {
      search = database.children[q];
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

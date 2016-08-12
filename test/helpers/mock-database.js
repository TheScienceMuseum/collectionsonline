// Create a mock elasticsearch client with noop functions
const database = require('../fixtures/elastic-responses/database.json');
const getNestedProperty = require('../../lib/nested-property');

module.exports = () => ({
  search: function () {
    var q;
    var search;
    const cb = arguments[arguments.length - 1];
    const searchName = arguments[0].searchName;

    if (searchName === 'defaultSearch') {
      q = getNestedProperty(arguments, '0.body.query.function_score.query.bool.must.multi_match.query') || 'all';
    }

    if (searchName === 'searchChildArchive') {
      q = arguments[0].body.query.constant_score.filter.bool.must.term['parent.admin.uid'];
    }

    if (searchName === 'searchRelatedItems') {
      q = arguments[0].body.query.constant_score.filter.bool.should[1].term['agents.admin.uid'];
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
      return cb({error: 'not found'});
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

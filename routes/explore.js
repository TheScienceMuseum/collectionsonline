const cacheHeaders = require('./route-helpers/cache-control');
// var contentType = require('./route-helpers/content-type.js');

module.exports = config => ({
  method: 'GET',
  path: '/explore',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (request, h) {
      const data = require('../fixtures/data');
      data.museums = require('../fixtures/museums');
      data.navigation = require('../fixtures/navigation');
      data.explore = require('../fixtures/explore');
      return h.view('explore', data);
    }
  }
});

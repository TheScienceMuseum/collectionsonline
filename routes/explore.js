const cacheHeaders = require('./route-helpers/cache-control');
// var contentType = require('./route-helpers/content-type.js');

module.exports = config => ({
  method: 'GET',
  path: '/explore',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (request, h) {
      const data = require('../fixtures/data');
      return h.view('explore', Object.assign({}, data, {
        museums: require('../fixtures/museums'),
        navigation: require('../fixtures/navigation'),
        explore: require('../fixtures/explore'),
        titlePage: 'Explore | Science Museum Group Collection'
      }));
    }
  }
});

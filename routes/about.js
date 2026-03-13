const cacheHeaders = require('./route-helpers/cache-control');
// var contentType = require('./route-helpers/content-type.js');

module.exports = config => ({
  method: 'GET',
  path: '/about',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (request, h) {
      const data = require('../fixtures/data');
      return h.view('about', Object.assign({}, data, {
        museums: require('../fixtures/museums'),
        navigation: require('../fixtures/navigation'),
        titlePage: 'About | Science Museum Group Collection'
      }));
    }
  }
});

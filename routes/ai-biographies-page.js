const cacheHeaders = require('./route-helpers/cache-control');

module.exports = config => ({
  method: 'GET',
  path: '/ai-biographies',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (request, h) {
      const data = require('../fixtures/data');
      return h.view('ai-biographies', Object.assign({}, data, {
        museums: require('../fixtures/museums'),
        navigation: require('../fixtures/navigation'),
        titlePage: 'About AI-generated biographies | Science Museum Group Collection'
      }));
    }
  }
});

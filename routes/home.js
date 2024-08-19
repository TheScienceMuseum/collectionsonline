const contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = config => ({
  method: 'GET',
  path: '/',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (request, h) {
      const responseType = contentType(request);
      if (responseType === 'json') {
        return h.response(
          'See https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API on how to use the api'
        );
      }

      if (responseType === 'html') {
        const data = require('../fixtures/data');
        data.navigation = require('../fixtures/navigation');
        data.museums = require('../fixtures/museums');
        data.inProduction = config && config.NODE_ENV === 'production';
        return h.view('home', data);
      }

      if (responseType === 'notAcceptable') {
        return h.response('Not Acceptable').code(406);
      }
    }
  }
});

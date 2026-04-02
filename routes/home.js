const contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');
const anniversary = require('../lib/anniversary');
const getAnniversaryData = anniversary;

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/',
  config: {
    cache: cacheHeaders(config, anniversary.secondsUntilNextPeriodUTC()),
    handler: async function (request, h) {
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
        data.links = { self: config.rootUrl };

        const anniversary = await getAnniversaryData(elastic, config);
        if (anniversary) {
          data.anniversary = anniversary;
        }

        return h.view('home', data);
      }

      if (responseType === 'notAcceptable') {
        return h.response('Not Acceptable').code(406);
      }
    }
  }
});

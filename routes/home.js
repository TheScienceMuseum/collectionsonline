const contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');
const memoizeAsync = require('../lib/helpers/memoize-async');
const anniversary = require('../lib/anniversary');
const getAnniversaryData = anniversary;
const getNameCollectionsData = require('../lib/name-collections');

// The homepage widgets cost ~55 Elasticsearch queries per render (50 of them
// name-collection lookups). Their picks only change once per widget period,
// so keep each widget's output in memory and rebuild it every few minutes
// rather than on every request. Concurrent renders share one rebuild.
const WIDGET_TTL_MS = 10 * 60 * 1000;
// A widget that comes back empty (usually an Elasticsearch failure) is
// retried after a minute instead of on the next request.
const WIDGET_RETRY_MS = 60 * 1000;

module.exports = (elastic, config) => {
  const loadAnniversary = memoizeAsync(getAnniversaryData, {
    key: anniversary.periodKey,
    ttlMs: WIDGET_TTL_MS,
    failureTtlMs: WIDGET_RETRY_MS
  });
  const loadNameCollections = memoizeAsync(getNameCollectionsData, {
    key: getNameCollectionsData.periodKey,
    ttlMs: WIDGET_TTL_MS,
    failureTtlMs: WIDGET_RETRY_MS
  });

  return {
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

          const [anniversaryData, nameCollections] = await Promise.all([
            loadAnniversary(elastic, config),
            loadNameCollections(elastic, config)
          ]);
          if (anniversaryData) {
            data.anniversary = anniversaryData;
          }
          if (nameCollections) {
            data.nameCollections = nameCollections;
          }

          return h.view('home', data);
        }

        if (responseType === 'notAcceptable') {
          return h.response('Not Acceptable').code(406);
        }
      }
    }
  };
};

const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = {
  rotational (elastic, config) {
    return {
      method: 'GET',
      path: '/embed/rotational/{coid}',
      config: {
        cache: cacheHeaders(config, 3600 * 24),
        handler: async function (request, h) {
          try {
            let configUrl;
            const result = await elastic.get({
              index: 'ciim',
              id: TypeMapping.toInternal(request.params.coid)
            });
            const res = await buildJSONResponse(result.body, config);

            if (res.data.attributes.enhancement) {
              res.data.attributes.enhancement.web.forEach((el) => {
                if (el.platform === '3D') {
                  const rid = el.id;
                  configUrl = 'https://s3-eu-west-1.amazonaws.com/' + rid + '/object.xml';
                }
              });
            }
            return h.view(
              'rotational',
              { configurl: configUrl },
              { layout: 'embed' }
            );
          } catch (err) {
            if (err.statusCode === 404) {
              return Boom.notFound();
            }
            return Boom.serverUnavailable(err);
          }
        }
      }
    };
  },
  rotationalDirect () {
    return {
      method: 'GET',
      path: '/embed/rotational/smgco-360/{rid}',
      config: {
        handler: function (request, h) {
          return h.view(
            'rotational',
            { configurl: 'https://s3-eu-west-1.amazonaws.com/smgco-360/' + request.params.rid + '/object.xml' },
            { layout: 'embed' }
          );
        }
      }
    };
  }
};

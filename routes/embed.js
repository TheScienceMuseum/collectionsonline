const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');

module.exports = {
  rotational (elastic, config) {
    return {
      method: 'GET',
      path: '/embed/rotational/{coid}',
      config: {
        handler: async function (request, h) {
          try {
            const result = await elastic.get({ index: 'smg', type: 'object', id: TypeMapping.toInternal(request.params.coid) });

            var res = buildJSONResponse(result, config);

            var configUrl;
            if (res.data.attributes.enhancement) {
              res.data.attributes.enhancement.web.find((el) => {
                if (el.platform === '3D') {
                  configUrl = 'https://s3-eu-west-1.amazonaws.com/' + el.id + '/object.xml';
                }
              });
            }
            return h.view(
              'rotational',
              { configurl: configUrl },
              { layout: 'embed' }
            );
          } catch (err) {
            if (err.status === 404) {
              return Boom.notFound();
            }
            return Boom.serverUnavailable('unavailable');
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


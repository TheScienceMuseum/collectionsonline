const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');

module.exports = {
  rotational (elastic, config) {
    return {
      method: 'GET',
      path: '/embed/rotational/{coid}',
      config: {
        handler: function (request, reply) {
          elastic.get({index: 'smg', type: 'object', id: TypeMapping.toInternal(request.params.coid)}, (err, result) => {
            if (err) {
              if (err.status === 404) {
                return reply(Boom.notFound());
              }
              return reply(Boom.serverUnavailable('unavailable'));
            }
            var res = buildJSONResponse(result, config);
            if (res.data.attributes.enhancement) {
              res.data.attributes.enhancement.web.find((el) => {
                // if (el.platform === 'rotational') {
                var rid = 'smgco-360/28f0ba52-6deb-43c0-a2e5-1fb82c5247cd'; // dummy test data
                var configUrl = 'https://s3-eu-west-1.amazonaws.com/' + rid + '/object.xml';
                return reply.view(
                    'rotational',
                    { configurl: configUrl },
                    { layout: 'embed' }
                );
                // }
              });
            }
          });
        }
      }
    };
  },
  rotationalDirect () {
    return {
      method: 'GET',
      path: '/embed/rotational/smgco-360/{rid}',
      config: {
        handler: function (request, reply) {
          return reply.view(
            'rotational',
            { configurl: 'https://s3-eu-west-1.amazonaws.com/smgco-360/' + request.params.rid + '/object.xml' },
            { layout: 'embed' }
          );
        }
      }
    };
  }
};


var getRotational = require('../lib/get-rotational');

module.exports = {
  rotational () {
    return {
      method: 'GET',
      path: '/embed/rotational/{coid}',
      config: {
        handler: function (request, reply) {
          return reply.view(
            'rotational',
            { configurl: getRotational(request.params.coid) },
            { layout: 'embed' }
          );
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


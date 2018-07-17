var getRotational = require('../lib/get-rotational');

module.exports = () => ({
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
});

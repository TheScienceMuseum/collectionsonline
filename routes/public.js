const Path = require('path');

module.exports = () => ({
  method: 'GET',
  path: '/{path*}',
  handler: function (req, reply) {
    reply.file(Path.resolve(__dirname, '..', 'public', req.params.path));
  },
  config: {
    plugins: {
      'hapi-negotiator': false
    }
  }
});

const Path = require('path');

module.exports = () => ({
  method: 'GET',
  path: '/{path*}',
  config: {
    handler: function (req, reply) {
      reply.file(Path.resolve(__dirname, '..', 'public', req.params.path));
    }
  }
});

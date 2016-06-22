const Path = require('path');

module.exports = () => ({
  method: 'GET',
  path: '/{path*}',
  handler: function (req, reply) {
    if (req.params.path.indexOf('bower_components') > -1) {
      reply.file(Path.resolve(__dirname, '..', req.params.path));
    } else {
      reply.file(Path.resolve(__dirname, '..', 'public', req.params.path));
    }
  },
  config: {
    plugins: {
      'hapi-negotiator': false
    }
  }
});

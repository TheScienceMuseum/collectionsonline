const Path = require('path');

module.exports = () => ({
  method: 'GET',
  path: '/{path*}',
  handler: function (req, reply) {
    reply.file(Path.join(__dirname, 'public', req.params.path));
  }
});

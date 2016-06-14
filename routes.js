var path = require('path');

module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: function (req, reply) {
      reply('OK');
    }
  },
  {
    method: 'GET',
    path: '/{path*}',
    handler: function (req, reply) {
      reply.file(path.join(__dirname, 'public', req.params.path));
    }
  }
];

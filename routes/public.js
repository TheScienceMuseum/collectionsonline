const Path = require('path');

module.exports = () => ({
  method: 'GET',
  path: '/{path*}',
  config: {
    handler: function (req, reply) {
      console.log('plublic.js: no file found here: ', req.params.path);
      reply.file(Path.resolve(__dirname, '..', 'public', req.params.path));
    }
  }
});

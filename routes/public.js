const Path = require('path');

module.exports = () => ({
  method: 'GET',
  path: '/{path*}',
  config: {
    handler: function (req, h) {
      return h.file(Path.resolve(__dirname, '..', 'public', req.params.path));
    }
  }
});

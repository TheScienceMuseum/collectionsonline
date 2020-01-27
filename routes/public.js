const Path = require('path');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (config) => ({
  method: 'GET',
  path: '/{path*}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (req, h) {
      return h.file(Path.resolve(__dirname, '..', 'public', req.params.path));
    }
  }
});

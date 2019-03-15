const validateToken = require('./validate-token');
const config = require('../config');
exports.plugin = {
  name: 'Authentication',
  register: async function (server, options) {
    server.state('token', {
      isSecure: false
    });
    server.auth.strategy('jwt', 'jwt',
      {
        key: config.JWT_SECRET,
        validate: validateToken,
        verifyOptions: { ignoreExpiration: true }
      });
    server.auth.default('jwt');
  }
}

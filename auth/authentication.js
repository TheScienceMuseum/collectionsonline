const validateToken = require('./validate-token');
const config = require('../config');
exports.register = function (server, options, next) {
  server.state('token', {
    isSecure: false
  });
  server.auth.strategy('jwt', 'jwt', false,
    {
      key: config.JWT_SECRET,
      validateFunc: validateToken,
      verifyOptions: { ignoreExpiration: true }
    });
  server.auth.default('jwt');
  return next();
};

exports.register.attributes = {
  name: 'Authentication'
};

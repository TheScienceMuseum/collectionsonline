const JWT = require('jsonwebtoken');
const validate = require('./validate');
const config = require('../config');
module.exports = () => ({
  method: 'POST',
  path: '/session',
  config: {
    auth: false
  },
  handler: (request, h) => {
    if (validate(request.payload.username, request.payload.password)) {
      const session = { valid: true };
      const jwt = JWT.sign(session, config.JWT_SECRET);
      console.log('GOOD');

      return h.redirect('/').state('token', jwt, { ttl: 5 * 3600 * 1000 });
    } else {
      console.log('BAD');

      return h.view('login', { error: 'wrong credentials, sorry' }, { layout: 'auth' });
    }
  }
});

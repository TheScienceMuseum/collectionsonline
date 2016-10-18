const Joi = require('joi');
var contentType = require('./route-helpers/content-type.js');

module.exports = (elastic, config) => ({
  method: 'POST',
  path: '/analytics',
  config: {
    validate: {
      payload: {
        event: Joi.string().valid('RESULT_CLICK').required(),
        data: Joi.string()
      }
    },
    handler: function (request, reply) {
      var responseType = contentType(request);
      if (responseType === 'json') {
        reply().code(204);
      } else {
        return reply();
      }
    }
  }
});

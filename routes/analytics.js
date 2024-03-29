const Joi = require('joi');
const contentType = require('./route-helpers/content-type.js');

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
    handler: function (request, h) {
      const responseType = contentType(request);
      if (responseType === 'json') {
        return h.response().code(204);
      } else {
        return h.response();
      }
    }
  }
});

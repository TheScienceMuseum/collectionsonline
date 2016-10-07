const Joi = require('joi');
var jsonContent = require('./route-helpers/json-content.js');

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
    plugins: {
      'hapi-negotiator': false
    },
    handler: function (request, reply) {
      var jsonResponse = jsonContent(request);
      if (jsonResponse) {
        reply().code(204);
      } else {
        return reply();
      }
    }
  }
});

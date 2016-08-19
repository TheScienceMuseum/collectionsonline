const Joi = require('joi');

module.exports = (elastic, config) => ({
  method: 'POST',
  path: '/analytics',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'application/vnd.api+json' (request, reply) {
            // TODO: Register analytics event
            reply().code(204);
          }
        }
      }
    },
    validate: {
      payload: {
        event: Joi.string().valid('RESULT_CLICK').required(),
        data: Joi.string()
      }
    }
  }
});

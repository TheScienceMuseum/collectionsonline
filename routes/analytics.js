const Joi = require('joi');
const scores = require('../lib/scores');

module.exports = (elastic, config) => ({
  method: 'POST',
  path: '/analytics',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'application/vnd.api+json' (request, reply) {
            scores.update(request.payload.data, function (err, result) {
              if (err) {
                console.log(err);
                reply().code(503);
              } else {
                reply().code(204);
              }
            });
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

const Joi = require('joi');
const contentType = require('./route-helpers/content-type.js');

// analytics click handler as no longer in use : JU 06/06/24
// this route was built but never activly used and is now redundent
// we also no longer allow POST requests via C.Frnt
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

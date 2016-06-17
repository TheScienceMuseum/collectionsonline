const Joi = require('joi');
const filterSchema = require('../schemas/filter');

module.exports = () => ({
  method: 'GET',
  path: '/search/{resource?}',
  handler: (request, reply) => reply(),
  config: {
    validate: {
      params: {
        resource: Joi.string().valid('objects', 'people', 'documents')
      },
      query: filterSchema.keys({
        'page[number]': Joi.number().integer().min(0),
        'page[size]': Joi.number().integer().min(1),
        'fields[objects]': Joi.string(),
        'fields[people]': Joi.string(),
        'fields[documents]': Joi.string()
      })
    },
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            reply.view('search');
          },
          'application/vnd.api+json' (req, reply) {
            reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
          }
        }
      }
    }
  }
});

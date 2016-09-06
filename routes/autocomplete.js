const Joi = require('joi');
const Boom = require('boom');
const autocomplete = require('../lib/autocomplete');
const autocompleteResultsToJsonApi = require('../lib/transforms/autocomplete-results-to-jsonapi');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/autocomplete/{type?}',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'application/vnd.api+json' (request, reply) {
            const queryParams = Object.assign({}, request.params, request.query);

            autocomplete(elastic, queryParams, (err, results) => {
              if (err) return reply(Boom.serverUnavailable(err));
              reply(autocompleteResultsToJsonApi(queryParams, results, config));
            });
          }
        }
      }
    },
    validate: {
      params: {
        type: Joi.string().valid('objects', 'people', 'documents')
      },
      query: {
        q: Joi.string().min(3).required(),
        size: Joi.number().integer().min(1).max(10).default(3)
      }
    }
  }
});

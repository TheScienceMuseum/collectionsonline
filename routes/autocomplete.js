const Joi = require('joi');
const TypeMapping = require('../lib/type-mapping');
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
            const must = [{
              match_phrase_prefix: {
                summary_title_text: { query: request.query.q }
              }
            }];

            if (request.params.type) {
              must.push({
                term: { 'type.base': TypeMapping.toInternal(request.params.type) }
              });
            }

            const searchOpts = {
              index: 'smg',
              size: request.query.size,
              _source: ['summary_title'],
              body: {
                query: {
                  bool: {
                    must,
                    filter: {
                      terms: { 'type.base': ['agent', 'archive', 'object'] }
                    }
                  }
                }
              }
            };

            elastic.search(searchOpts, (err, results) => {
              if (err) return reply(err);
              const queryParams = Object.assign({}, request.params, request.query);
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

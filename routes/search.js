const Joi = require('joi');
const filterSchema = require('../schemas/filter');
const searchResultsToJsonApi = require('../lib/transforms/search-results-to-jsonapi');
const searchResultsToTemplateData = require('../lib/transforms/search-results-to-template-data');
const TypeMapping = require('../lib/type-mapping');

module.exports = ({ elastic, config }) => ({
  method: 'GET',
  path: '/search/{type?}',
  handler: (request, reply) => reply(),
  config: {
    validate: {
      params: {
        type: Joi.string().valid('objects', 'people', 'documents')
      },
      query: filterSchema.keys({
        q: Joi.string().required(),
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
            const pageNumber = request.query['page[number]'] || 0;
            const pageSize = request.query['page[size]'] || 50;

            const searchOpts = {
              index: 'smg',
              q: request.query.q,
              from: pageNumber * pageSize,
              size: pageSize
            };

            if (request.params.type) {
              searchOpts.type = TypeMapping.toInternal(request.params.type);
              // Params type filter trumps query type filter
              request.query['filter[type]'] = request.params.type;
            }

            elastic.search(searchOpts, (err, result) => {
              if (err) return reply(err);

              const jsonData = searchResultsToJsonApi(request.query, result, config);
              const tplData = searchResultsToTemplateData(request.query, jsonData);

              reply.view('search', tplData);
            });
          },
          'application/vnd.api+json' (request, reply) {
            const pageNumber = request.query['page[number]'] || 0;
            const pageSize = request.query['page[size]'] || 50;

            const searchOpts = {
              index: 'smg',
              q: request.query.q,
              from: pageNumber * pageSize,
              size: pageSize
            };

            if (request.params.type) {
              searchOpts.type = TypeMapping.toInternal(request.params.type);
              // Params type filter trumps query type filter
              request.query['filter[type]'] = request.params.type;
            }

            elastic.search(searchOpts, (err, result) => {
              if (err) return reply(err);

              reply(searchResultsToJsonApi(request.query, result, config))
                .header('content-type', 'application/vnd.api+json');
            });
          }
        }
      }
    }
  }
});

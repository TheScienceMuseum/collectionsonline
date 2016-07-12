const Joi = require('joi');
const Boom = require('boom');
const filterSchema = require('../schemas/filter');
const searchSchema = require('../schemas/search');
const searchResultsToJsonApi = require('../lib/transforms/search-results-to-jsonapi');
const searchResultsToTemplateData = require('../lib/transforms/search-results-to-template-data');
const search = require('../lib/search');
const createQueryParams = require('../lib/query-params');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/search/{type?}',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            Joi.validate({query: request.query, params: request.params},
              {
                params: {
                  type: Joi.string().valid('objects', 'people', 'documents')
                },
                query: filterSchema('html').keys(searchSchema)
              }, (err, value) => {
                if (err) return reply(Boom.badRequest(err));

                const params = value.params;
                const query = value.query;

                const queryParams = createQueryParams('html', {query: query, params: params});
                search(elastic, queryParams, (err, result) => {
                  if (err) return reply(Boom.badRequest(err));

                  const jsonData = searchResultsToJsonApi(queryParams, result, config);
                  const tplData = searchResultsToTemplateData(queryParams, jsonData);

                  reply.view('search', tplData);
                });
              }
            );
          },
          'application/vnd.api+json' (request, reply) {
            Joi.validate({query: request.query, params: request.params},
              {
                params: {
                  type: Joi.string().valid('objects', 'people', 'documents')
                },
                query: filterSchema('json').keys(searchSchema)
              }, (err, value) => {
                if (err) return reply(Boom.badRequest());

                const params = value.params;
                const query = value.query;
                const queryParams = createQueryParams('json', {query: query, params: params});
                search(elastic, queryParams, (err, result) => {
                  if (err) return reply(Boom.badRequest(err));

                  reply(searchResultsToJsonApi(queryParams, result, config))
                    .header('content-type', 'application/vnd.api+json');
                });
              }
            );
          }
        }
      }
    }
  }
});

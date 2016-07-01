const Joi = require('joi');
const Boom = require('boom');
const filterSchema = require('../schemas/filter');
const searchSchema = require('../schemas/search');
const searchResultsToJsonApi = require('../lib/transforms/search-results-to-jsonapi');
const searchResultsToTemplateData = require('../lib/transforms/search-results-to-template-data');
const search = require('../lib/search');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/search/{type?}',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            var queryParams = {query: request.query, params: request.params};
            Joi.validate(queryParams,
              {
                params: {
                  type: Joi.string().valid('objects', 'people', 'documents')
                },
                query: filterSchema('html').keys(searchSchema)
              }, (err, value) => {
                if (err) return reply(Boom.badRequest(err));

                const params = value.params;
                const query = value.query;

                search(elastic, {params, query}, (err, result) => {
                  if (err) return reply(err);

                  const jsonData = searchResultsToJsonApi(query, result, config);
                  const tplData = searchResultsToTemplateData(query, jsonData);

                  reply.view('search', tplData);
                });
              }
            );
          },
          'application/vnd.api+json' (request, reply) {
            var queryParams = {query: request.query, params: request.params};
            Joi.validate(queryParams,
              {
                params: {
                  type: Joi.string().valid('objects', 'people', 'documents')
                },
                query: filterSchema('json').keys(searchSchema)
              }, (err, value) => {
                if (err) return reply(Boom.badRequest());

                const params = value.params;
                const query = value.query;

                search(elastic, {params, query}, (err, result) => {
                  if (err) return reply(err);

                  reply(searchResultsToJsonApi(query, result, config))
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

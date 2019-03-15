const Joi = require('joi');
const Boom = require('boom');
const autocomplete = require('../lib/autocomplete');
const autocompleteResultsToJsonApi = require('../lib/transforms/autocomplete-results-to-jsonapi');
const contentType = require('./route-helpers/content-type.js');
const whatis = require('../fixtures/whatis');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/autocomplete/{type?}',
  config: {
    validate: {
      params: {
        type: Joi.string().valid('objects', 'people', 'documents')
      },
      query: {
        q: Joi.string().min(3).required(),
        size: Joi.number().integer().min(1).max(10).default(3)
      }
    },
    handler: async function (request, h) {
      var responseType = contentType(request);

      if (responseType === 'json') {
        const queryParams = Object.assign({}, request.params, request.query);

        // display an autocomple list of 'What is' questions
        if (queryParams.q.startsWith('what')) {
          return h.response(whatis);
        }

        try {
          const results = await autocomplete(elastic, queryParams);
          return h.response(autocompleteResultsToJsonApi(queryParams, results, config));
        } catch (err) {
          return Boom.serverUnavailable(err);
        }
      } else {
        return h.response();
      }
    }
  }
});

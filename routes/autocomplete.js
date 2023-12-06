const Joi = require('joi');
const Boom = require('@hapi/boom');
const autocomplete = require('../lib/autocomplete');
const autocompleteResultsToJsonApi = require('../lib/transforms/autocomplete-results-to-jsonapi');
const contentType = require('./route-helpers/content-type.js');
const whatis = require('../fixtures/whatis');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/autocomplete/{type?}',
  options: {
    validate: {
      params: {
        type: Joi.string().valid('objects', 'people', 'documents')
      },
      query: {
        q: Joi.string().min(3).required(),
        size: Joi.number().integer().min(1).max(10).default(3)
      },
      failAction: function (request, h, err) {
        if (err.output.statusCode === 400) {
          return h.response(err.output.payload.message).code(400).takeover();
        }
      }
    }
  },
  handler: async function (request, h) {
    const responseType = contentType(request);
    if (responseType === 'json') {
      const queryParams = Object.assign({}, request.params, request.query);

      // display an autocomple list of 'What is' questions
      if (queryParams.q.startsWith('what')) {
        return h.response(whatis);
      }

      try {
        const results = await autocomplete(elastic, queryParams);

        const apiResults = autocompleteResultsToJsonApi(queryParams, results, config);

        return h.response(apiResults);
      } catch (err) {
        return Boom.serverUnavailable(err);
      }
    } else {
      return h.response();
    }
  }
});

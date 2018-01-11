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
    handler: function (request, reply) {
      var responseType = contentType(request);

      if (responseType === 'json') {
        const queryParams = Object.assign({}, request.params, request.query);

        // display an autocomple list of 'What is' questions
        if (queryParams.q.startsWith('what')) {
          return reply(whatis);
        }

        autocomplete(elastic, queryParams, (err, results) => {
          if (err) return reply(Boom.serverUnavailable(err));
          return reply(autocompleteResultsToJsonApi(queryParams, results, config));
        });
      } else {
        return reply();
      }
    }
  }
});

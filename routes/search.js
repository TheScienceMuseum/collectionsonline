const Joi = require('joi');
const Boom = require('boom');
const filterSchema = require('../schemas/filter');
const searchSchema = require('../schemas/search');
const searchResultsToJsonApi = require('../lib/transforms/search-results-to-jsonapi');
const searchResultsToTemplateData = require('../lib/transforms/search-results-to-template-data');
const search = require('../lib/search');
const createQueryParams = require('../lib/query-params/query-params');
const contentType = require('./route-helpers/content-type.js');
const parseParameters = require('./route-helpers/parse-params');
const keyCategories = require('../fixtures/key-categories');
const whatis = require('../fixtures/whatis');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/search/{filters*}',
  config: {
    handler: function (request, reply) {
      var responseType = contentType(request);

      if (responseType === 'notAcceptable') {
        return reply('Not Acceptable').code(406);
      }

      Joi.validate({query: request.query},
        {
          query: filterSchema(responseType).keys(searchSchema.query)
        }, {allowUnknown: true}, (err, value) => {
          if (err) return reply(Boom.badRequest(err));

          const params = parseParameters(request.params).params;
          const categories = parseParameters(request.params).categories;

          Joi.validate({params: params, categories: categories, query: value.query},
            {
              params: Joi.any(),
              categories: filterSchema('html').keys(searchSchema.query),
              query: filterSchema('html').keys(searchSchema.query)
            }, {allowUnknown: true}, (err, value) => {
              if (err) return reply(Boom.badRequest(err));

              // match categories
              if (value.query.q && (!value.categories['filter[categories]'])) {
                var q = value.query.q.toLowerCase();
                var qMatch;

                if (keyCategories.some(el => {
                  if (el.category === q || el.synonyms.indexOf(q) > -1) {
                    qMatch = el.category;
                    return true;
                  } else {
                    return false;
                  }
                })) {
                  return reply.redirect(request.path + '/categories/' + qMatch);
                }
              }

              const query = Object.assign(value.query, value.params, value.categories);
              const queryParams = createQueryParams(responseType, {query: query, params: params});

              if (responseType === 'html') {
                // match and answer 'what is' questions
                if (value.query.q && value.query.q.toLowerCase().startsWith('what')) {
                  var answer = whatis.data.filter((a) => a.attributes.summary_title.toLowerCase() === value.query.q.toLowerCase());
                  if (answer.length > 0) {
                    return reply.redirect(answer[0].links.self);
                  }
                }

                search(elastic, queryParams, (err, result) => {
                  if (err) return reply(Boom.serverUnavailable(err));

                  const jsonData = searchResultsToJsonApi(queryParams, result, config);
                  const tplData = searchResultsToTemplateData(queryParams, jsonData);

                  return reply.view('search', tplData);
                });
              } else if (responseType === 'json') {
                search(elastic, queryParams, (err, result) => {
                  if (err) return reply(Boom.serverUnavailable(err));
                  return reply(searchResultsToJsonApi(queryParams, result, config))
                  .header('content-type', 'application/vnd.api+json');
                });
              }
            }
          );
        }
      );
    }
  }
});

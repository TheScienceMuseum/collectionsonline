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
    handler: async function (request, h) {
      var responseType = contentType(request);

      if (responseType === 'notAcceptable') {
        return h.response('Not Acceptable').code(406);
      }
      try {
        const value = await Joi.validate(
          { query: request.query },
          { query: filterSchema(responseType).keys(searchSchema.query) },
          { allowUnknown: true }
        );

        const params = parseParameters(request.params).params;
        const categories = parseParameters(request.params).categories;

        const result = await Joi.validate(
          { params: params, categories: categories, query: value.query },
          {
            params: Joi.any(),
            categories: filterSchema('html').keys(searchSchema.query),
            query: filterSchema('html').keys(searchSchema.query)
          },
          { allowUnknown: true }
        );

        // match categories
        if (result.query.q && (!result.categories['filter[categories]'])) {
          var q = result.query.q.toLowerCase();
          var qMatch;

          if (keyCategories.some(el => {
            if (el.category === q || el.synonyms.indexOf(q) > -1) {
              qMatch = el.category;
              return true;
            } else {
              return false;
            }
          })) {
            return h.redirect(request.path + '/categories/' + qMatch);
          }
        }

        const query = Object.assign(result.query, result.params, result.categories);
        const queryParams = createQueryParams(responseType, { query: query, params: params });

        if (responseType === 'html') {
          // match and answer 'what is' questions
          if (result.query.q && result.query.q.toLowerCase().startsWith('what')) {
            var answer = whatis.data.filter((a) => a.attributes.summary_title.toLowerCase() === result.query.q.toLowerCase());
            if (answer.length > 0) {
              return h.redirect(answer[0].links.self);
            }
          }

          const res = await search(elastic, queryParams);

          const jsonData = searchResultsToJsonApi(queryParams, res, config);
          const tplData = searchResultsToTemplateData(queryParams, jsonData);

          return h.view('search', tplData);
        } else if (responseType === 'json') {
          const res = await search(elastic, queryParams);

          return h.response(searchResultsToJsonApi(queryParams, res, config))
            .header('content-type', 'application/vnd.api+json');
        }
      } catch (err) {
        if (err.isJoi) {
          return Boom.badRequest();
        }

        return Boom.serverUnavailable();
      }
    }
  }
});

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
const keyCollections = require('../fixtures/key-categories');
const whatis = require('../fixtures/whatis');
const searchResultsToSlideshow = require('../lib/transforms/slideshow');

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

        const query = Object.assign(result.query, result.params, result.categories);
        let queryParams = createQueryParams(responseType, { query: query, params: params });

        if (responseType === 'html') {
          // slideshow
          if (request.params.filters && request.params.filters.indexOf('slideshow') > -1) {
            queryParams.filter.objects.hasImage = ['has_image'];
            queryParams.filter.all.hasImage = ['has_image'];

            const query = Object.assign(queryParams, { type: 'objects', random: 100 });
            const res = await search(elastic, query);
            const data = searchResultsToSlideshow(queryParams, res, config);

            return h.view('slideshow', { data: data, stringData: JSON.stringify(data) });
          }

          // match categories
          if (result.query.q && (!result.categories['filter[categories]'])) {
            let q = result.query.q.toLowerCase();
            let qMatch;

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

          // match collection
          if (result.query.q && (!result.categories['filter[collection]'])) {
            let q = result.query.q.toLowerCase();
            let qMatch;

            if (keyCollections.some(el => {
              if (el.collection === q || el.synonyms.indexOf(q) > -1) {
                qMatch = el.collection;
                return true;
              } else {
                return false;
              }
            })) {
              return h.redirect(request.path + '/categories/' + qMatch);
            }
          }

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

          var response = h.view('search', tplData);
          // Only set a Cache-Control if we don't have a freetext query string and aren't running on production
          if (!result.query.q && !result.query.random && config && config.NODE_ENV === 'production') {
            response.header('Cache-Control', 'public, must-revalidate, max-age: 43200');
          }
          return response;
        } else if (responseType === 'json') {
          const res = await search(elastic, queryParams);

          return h.response(searchResultsToJsonApi(queryParams, res, config))
            .header('content-type', 'application/vnd.api+json');
        }
      } catch (err) {
        if (err.isJoi) {
          return Boom.badRequest();
        }

        return Boom.serverUnavailable(err);
      }
    }
  }
});

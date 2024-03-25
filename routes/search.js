const Joi = require('joi');
const Boom = require('@hapi/boom');
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
const parentCollection = require('../lib/get-search-parent.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/search/{filters*}',
  config: {
    handler: async function (request, h) {
      const responseType = contentType(request);
      if (responseType === 'notAcceptable') {
        return h.response('Not Acceptable').code(406);
      }
      try {
        const querySchema = Joi.object({
          query: filterSchema(responseType).keys(searchSchema.query),
        });
        const validation = querySchema.validate(
          { query: request.query },
          { allowUnknown: true }
        );

        if (validation.error) return Boom.badRequest();

        const value = validation.value;
        const params = parseParameters(request.params).params;
        const categories = parseParameters(request.params).categories;

        const resultSchema = Joi.object({
          params: Joi.any(),
          categories: filterSchema('html').keys(searchSchema.query),
          query: filterSchema('html').keys(searchSchema.query),
        });
        const result = await resultSchema.validate(
          { params, categories, query: value.query },
          { allowUnknown: true }
        ).value;
        const query = Object.assign(
          result.query,
          result.params,
          result.categories
        );

        const queryParams = createQueryParams(responseType, { query, params });

        if (responseType === 'html') {
          // slideshow
          if (
            request.params.filters &&
            request.params.filters.indexOf('slideshow') > -1
          ) {
            queryParams.filter.objects.hasImage = ['has_image'];
            queryParams.filter.all.hasImage = ['has_image'];

            const query = Object.assign(queryParams, {
              type: 'objects',
              random: 100,
            });
            const res = await search(elastic, query);
            const data = searchResultsToSlideshow(queryParams, res, config);

            return h.view('slideshow', {
              data,
              stringData: JSON.stringify(data),
            });
          }
          // match categories
          if (result.query.q && !result.categories['filter[categories]']) {
            const q = result.query.q.toLowerCase();
            let qMatch;

            if (
              keyCategories.some((el) => {
                if (el.category === q || el.synonyms.indexOf(q) > -1) {
                  qMatch = el.category;
                  return true;
                } else {
                  return false;
                }
              })
            ) {
              return h.redirect(request.path + '/categories/' + qMatch);
            }
          }

          // match collection
          if (result.query.q && !result.categories['filter[collection]']) {
            const q = result.query.q.toLowerCase();
            let qMatch;

            if (
              keyCollections.some((el) => {
                if (el.collection === q || el.synonyms.indexOf(q) > -1) {
                  qMatch = el.collection;
                  return true;
                } else {
                  return false;
                }
              })
            ) {
              return h.redirect(request.path + '/categories/' + qMatch);
            }
          }

          // match and answer 'what is' questions
          if (
            result.query.q &&
            result.query.q.toLowerCase().startsWith('what')
          ) {
            const answer = whatis.data.filter(
              (a) =>
                a.attributes.summary_title.toLowerCase() ===
                result.query.q.toLowerCase()
            );
            if (answer.length > 0) {
              return h.redirect(answer[0].links.self);
            }
          }

          // extra query for mph search results, in order to show pillbox/filterbadges
          // currently hard coded in other search collections with pillboxes - dynamic here
          const type = 'mphc';
          const isMphcType = queryParams.query[`filter[${type}]`];

          let mphcParent = null;
          if (isMphcType) {
            mphcParent = await parentCollection(elastic, queryParams);
          }
          const res = await search(elastic, queryParams);

          const jsonData = searchResultsToJsonApi(
            queryParams,
            res,
            config,
            mphcParent || null
          );
          const tplData = searchResultsToTemplateData(
            queryParams,
            jsonData,
            config
          );

          const response = h.view('search', tplData);
          // Only set a Cache-Control if we don't have a freetext query string and aren't running on production
          if (
            !result.query.q &&
            !result.query.random &&
            config &&
            config.NODE_ENV === 'production'
          ) {
            response.header(
              'Cache-Control',
              'public, must-revalidate, max-age: 43200'
            );
          }
          return response;
        } else if (responseType === 'json') {
          const mphcParent = await parentCollection(elastic, queryParams);
          const res = await search(elastic, queryParams);
          return h
            .response(
              searchResultsToJsonApi(
                queryParams,
                res,
                config,
                mphcParent || null
              )
            )
            .header('content-type', 'application/vnd.api+json');
        }
      } catch (err) {
        return Boom.serverUnavailable(err);
      }
    },
  },
});

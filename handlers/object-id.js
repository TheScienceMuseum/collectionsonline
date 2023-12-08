'use strict';

const slug = require('slugg');

module.exports = function (elastic, config) {
  return async function (request, h) {
    const body = {
      query: {
        bool: { filter: { term: { 'identifier.value': request.params.idObject } } }
      }
    };
    const searchOpts = {
      index: 'ciim',
      body
    };
    const jsonResult = {};
    let result;

    try {
      result = await elastic.search(searchOpts);

      if (result.body.hits.total.value === 0) {
        jsonResult.found = false;
        jsonResult.error = 'Not Found';
        jsonResult.path = '';

        return h.response(jsonResult).code(404);
      }

      jsonResult.found = true;
      jsonResult.error = null;
    } catch (error) {
      jsonResult.error = error;
    }

    const obj = result.body.hits.hits[0];
    let slugValue = obj._source.summary?.title && slug(obj._source.summary.title).toLowerCase();
    slugValue = slugValue ? ('/' + slugValue) : '';
    jsonResult.path = '/objects/' + obj._id + slugValue;

    // check for redirect query parameter
    if (request.query.redirect === 'true') {
      return h.redirect(config.rootUrl + jsonResult.path).permanent();
    }

    return h.response(jsonResult);
  };
};

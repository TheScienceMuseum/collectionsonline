'use strict';

const slug = require('slugg');

module.exports = function (elastic, config) {
  return async function (request, h) {
    var body = {
      query: {
        bool: { filter: { term: { 'identifier.value': request.params.idObject } } }
      }
    };
    var searchOpts = {
      index: 'ciim',
      body: body
    };
    var jsonResult = {};
    let result;

    try {
      result = await elastic.search(searchOpts);

      if (result.hits.total === 0) {
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

    var obj = result.hits.hits[0];
    var slugValue = obj._source.summary_title && slug(obj._source.summary_title).toLowerCase();
    slugValue = slugValue ? ('/' + slugValue) : '';
    jsonResult.path = '/objects/' + obj._id + slugValue;

    // check for redirect query parameter
    if (request.query.redirect === 'true') {
      return h.redirect(config.rootUrl + jsonResult.path).permanent();
    }

    return h.response(jsonResult);
  };
};

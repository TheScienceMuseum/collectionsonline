'use strict';

const slug = require('slugg');

module.exports = function (elastic, config) {
  return function (request, reply) {
    var body = {
      query: {
        bool: { filter: { term: { 'identifier.value': request.params.idObject } } }
      }
    };
    var searchOpts = {
      index: 'smg',
      body: body
    };
    var jsonResult = {};

    elastic.search(searchOpts, function (error, result) {
      // no object found
      if (result.hits.total === 0) {
        jsonResult.found = false;
        jsonResult.error = 'Not Found';
        jsonResult.searchError = error;
        jsonResult.path = '';

        return reply(jsonResult).code(404);
      }

      jsonResult.found = true;
      jsonResult.error = null;
      jsonResult.searchError = error;

      var obj = result.hits.hits[0];
      var slugValue = obj._source.summary_title && slug(obj._source.summary_title).toLowerCase();
      slugValue = slugValue ? ('/' + slugValue) : '';
      jsonResult.path = '/objects/' + obj._id + slugValue;

      // check for redirect query parameter
      if (request.query.redirect === 'true') {
        return reply.redirect(config.rootUrl + jsonResult.path).permanent();
      }

      return reply(jsonResult);
    });
  };
};

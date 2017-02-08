'use strict';

var Boom = require('boom');

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
      if (error) {
        return reply(Boom.serverUnavailable(error));
      }

      // no object found
      if (result.hits.total === 0) {
        jsonResult.found = false;
        jsonResult.error = 'Not Found';
        jsonResult.path = '';

        return reply(jsonResult).code(404);
      }

      jsonResult.found = true;
      jsonResult.error = null;
      jsonResult.path = '/objects/' + result.hits.hits[0]._id;

      // check for redirect query parameter
      if (request.query.redirect === 'true') {
        return reply.redirect(jsonResult.path);
      }

      return reply(jsonResult);
    });
  };
};

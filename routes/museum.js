const Joi = require('joi');
const Boom = require('boom');
const filterSchema = require('../schemas/filter');
const searchSchema = require('../schemas/search');
var Querystring = require('querystring');

module.exports = {
  scm () {
    return {
      method: 'GET',
      path: '/scm',
      handler: function (request, reply) {
        museumRedirect(request, reply, 'science-museum');
      }
    };
  },
  msi () {
    return {
      method: 'GET',
      path: '/msi',
      handler: function (request, reply) {
        museumRedirect(request, reply, 'museum-of-science-and-industry');
      }
    };
  },
  nrm () {
    return {
      method: 'GET',
      path: '/nrm',
      handler: function (request, reply) {
        museumRedirect(request, reply, 'national-railway-museum');
      }
    };
  },
  nmem () {
    return {
      method: 'GET',
      path: '/nmem',
      handler: function (request, reply) {
        museumRedirect(request, reply, 'national-media-museum');
      }
    };
  }
};

function museumRedirect (request, reply, museum) {
  Joi.validate({query: request.query},
    {
      query: filterSchema('json').keys(searchSchema)
    }, (err, value) => {
      if (err) return reply(Boom.badRequest(err));

      reply.redirect('/search/museum/' + museum + Querystring.stringify(request.query));
    }
  );
}

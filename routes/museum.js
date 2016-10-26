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
        museumRedirect(request, reply, 'Science Museum');
      }
    };
  },
  msi () {
    return {
      method: 'GET',
      path: '/msi',
      handler: function (request, reply) {
        museumRedirect(request, reply, 'Museum of Science and Industry');
      }
    };
  },
  nrm () {
    return {
      method: 'GET',
      path: '/nrm',
      handler: function (request, reply) {
        museumRedirect(request, reply, 'National Railway Museum');
      }
    };
  },
  nmem () {
    return {
      method: 'GET',
      path: '/nmem',
      handler: function (request, reply) {
        museumRedirect(request, reply, 'National Media Museum');
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

      request.query['filter[museum]'] = museum;
      reply.redirect('/search?' + Querystring.stringify(request.query));
    }
  );
}

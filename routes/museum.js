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
      handler: function (request, h) {
        museumRedirect(request, h, 'science-museum');
      }
    };
  },
  msi () {
    return {
      method: 'GET',
      path: '/msi',
      handler: function (request, h) {
        museumRedirect(request, h, 'museum-of-science-and-industry');
      }
    };
  },
  nrm () {
    return {
      method: 'GET',
      path: '/nrm',
      handler: function (request, h) {
        museumRedirect(request, h, 'national-railway-museum');
      }
    };
  },
  nmem () {
    return {
      method: 'GET',
      path: '/nmem',
      handler: function (request, h) {
        museumRedirect(request, h, 'national-media-museum');
      }
    };
  }
};

async function museumRedirect (request, h, museum) {
  try {
    await Joi.validate({ query: request.query }, { query: filterSchema('json').keys(searchSchema) });

    return h.redirect('/search/museum/' + museum + Querystring.stringify(request.query));
  } catch (err) {
    return Boom.badRequest(err);
  }
}

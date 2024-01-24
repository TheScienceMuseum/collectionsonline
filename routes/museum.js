const Joi = require('joi');
const Boom = require('@hapi/boom');
const filterSchema = require('../schemas/filter');
const searchSchema = require('../schemas/search');
const Querystring = require('querystring');

module.exports = {
  scm () {
    return {
      method: 'GET',
      path: '/scm',
      handler: function (request, h) {
        return museumRedirect(request, h, 'science-museum');
      }
    };
  },
  msi () {
    return {
      method: 'GET',
      path: '/msi',
      handler: function (request, h) {
        return museumRedirect(request, h, 'museum-of-science-and-industry');
      }
    };
  },
  nrm () {
    return {
      method: 'GET',
      path: '/nrm',
      handler: function (request, h) {
        return museumRedirect(request, h, 'national-railway-museum');
      }
    };
  },
  nsmm () {
    return {
      method: 'GET',
      path: '/msi',
      handler: function (request, h) {
        return museumRedirect(request, h, 'national-science-and-media-museum');
      }
    };
  },
  nmem () {
    return {
      method: 'GET',
      path: '/nmem',
      handler: function (request, h) {
        return museumRedirect(request, h, 'national-media-museum');
      }
    };
  }
};

async function museumRedirect (request, h, museum) {
  try {
    const schema = Joi.object({ query: filterSchema('json').keys(searchSchema) });
    await schema.validate({ query: request.query });

    return h.redirect('/search/museum/' + museum + Querystring.stringify(request.query));
  } catch (err) {
    return Boom.badRequest(err);
  }
}

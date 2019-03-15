const Joi = require('joi');
const Boom = require('boom');
const filterSchema = require('../schemas/filter');
const searchSchema = require('../schemas/search');
var Querystring = require('querystring');

// we possible should investigate using this NPM module instead?
// https://github.com/lob/hapi-permanent-redirect

module.exports = {
  medicine() {
    return {
      method: 'GET',
      path: '/search/categories/oriental-medicine',
      handler: function (request, h) {
        redirect(request, h, '/search/categories/asian-medicine');
      }
    };
  }
};

async function redirect(request, h, path) {
  try {
    await Joi.validate({ query: request.query }, { query: filterSchema('json').keys(searchSchema) });

    h.redirect(path + Querystring.stringify(request.query));
  } catch (err) { return Boom.badRequest(err) };
}


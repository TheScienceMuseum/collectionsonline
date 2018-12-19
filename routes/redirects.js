const Joi = require('joi');
const Boom = require('boom');
const filterSchema = require('../schemas/filter');
const searchSchema = require('../schemas/search');
var Querystring = require('querystring');

// we possible should investigate using this NPM module instead?
// https://github.com/lob/hapi-permanent-redirect

module.exports = {
  medicine () {
    return {
      method: 'GET',
      path: '/search/categories/oriental-medicine',
      handler: function (request, reply) {
        redirect(request, reply, '/search/categories/asian-medicine');
      }
    };
  }
};

function redirect (request, reply, path) {
  Joi.validate({query: request.query},
    {
      query: filterSchema('json').keys(searchSchema)
    }, (err, value) => {
      if (err) return reply(Boom.badRequest(err));
      reply.redirect(path + Querystring.stringify(request.query));
    }
  );
}

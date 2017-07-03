const Boom = require('boom');
const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';

// Heavily based on the excellent https://github.com/dwyl/hapi-error
// and https://gist.github.com/wraithgar/231ee3717b4d2da54044
exports.register = (server, options, next) => {
  options = options || {};

  server.ext('onPreResponse', (request, reply) => {
    // Only interested in errors
    if (!(request.response instanceof Error)) return reply.continue();

    const error = Boom.wrap(request.response);
    const accept = request.headers.accept || '';

    if (error.output.statusCode >= 500) {
      console.error(error.stack);
    }

    if (accept.indexOf('text/html') === 0) {
      // Respond with an error template
      if (error.output.statusCode === 401) {
        return reply.redirect('/login');
      }

      if (error.output.statusCode === 404) {
        var data = {};
        data.footer = require('../../fixtures/footer');
        data.museums = require('../../fixtures/museums');
        data.items = require('../../fixtures/404.js')(options.config);
        return reply.view('404', data).code(404);
      }

      return reply
        .view(options.template || 'error', { error, isDevelopment })
        .code(error.output.statusCode);
    }

    if (accept.indexOf('application/vnd.api+json') === 0) {
      // Simply reformat the payload http://jsonapi.org/format/#errors
      request.response.output.payload = {
        errors: [{
          title: error.output.payload.error,
          status: error.output.statusCode,
          detail: error.output.payload.message
        }]
      };
    }

    reply.continue(); // Whatever Hapi wants to do...
  });

  next();
};

exports.register.attributes = { name: 'hapi-co-error', version: '0.0.0' };

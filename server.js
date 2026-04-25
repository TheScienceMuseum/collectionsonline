const H2o2 = require('@hapi/h2o2');
const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Joi = require('joi');
const Vision = require('@hapi/vision');
const routes = require('./routes');
const auth = require('./auth');

module.exports = async (elastic, config, cb) => {
  const server = new Hapi.Server({ port: config.port, routes: { cors: { origin: 'ignore' }, log: { collect: true } } });
  server.validator(Joi);
  server.route(routes(elastic, config));

  if (config.auth) {
    server.route(auth());
    await server.register(require('hapi-auth-jwt2'));
    await server.register(require('./auth/authentication'));
  }

  try {
    await server.register([
      Inert,
      Vision,
      H2o2,
      {
        plugin: require('./routes/plugins/error'),
        options: {
          config
        }
      }
    ]);
  } catch (err) {
    return cb(err);
  }

  // Register admin cookie for AI biography admin interface
  server.state('adminToken', {
    ttl: 24 * 60 * 60 * 1000,
    isSecure: config.NODE_ENV === 'production',
    isHttpOnly: true,
    isSameSite: 'Strict',
    path: '/admin',
    encoding: 'none',
    strictHeader: false
  });

  server.views({
    engines: { html: { module: require('handlebars'), compileMode: 'sync' } },
    relativeTo: __dirname,
    path: './templates/pages',
    layout: 'default',
    layoutPath: './templates/layouts',
    partialsPath: './templates/partials',
    helpersPath: './templates/helpers',
    // Global view context — merged into every h.view() render. Exposes
    // the logged-in admin username (if any) so layouts can surface it
    // in the header without every admin-route handler having to pass
    // it individually. Empty string for unauthenticated / non-admin
    // requests.
    context: function (request) {
      const cookieUser = request && request.state && request.state.adminUser;
      return { loggedInUser: cookieUser || '' };
    }
  });

  cb(null, { server, elastic });
};

const H2o2 = require('@hapi/h2o2');
const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Joi = require('joi');
const Vision = require('@hapi/vision');
const routes = require('./routes');
const auth = require('./auth');
const checkBundleFreshness = require('./lib/check-bundle-freshness');

module.exports = async (elastic, config, cb) => {
  // Boot-time sanity check — warns loudly if public/bundle.js is older
  // than the source files baked into it. Catches the "I edited a partial
  // but forgot to rebuild" failure mode before visitors notice. No-op in
  // production where postinstall keeps the bundle current. See module
  // header for context.
  checkBundleFreshness();

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

  // Inject visualSearchEnabled into every view-typed response just
  // before render, so partials (e.g. the searchbox) can gate UI on
  // the feature flag without each route having to thread it through.
  // Implemented as an onPreResponse extension rather than
  // @hapi/vision's `context` option because the latter wasn't
  // reliably reaching the layout / partial render context in our
  // Hapi 21 / Vision 7 setup — symptoms: meta tag missing from
  // <head>, searchbox class not applied, even with the global
  // context block in place.
  //
  // Note: the template variable `visualSearchEnabled` is sourced from
  // config.visualSearchIconEnabled, NOT config.visualSearchEnabled.
  // From a template's POV the flag means "should the icon show?",
  // which lets us soft-launch the feature (route on, icon off) by
  // setting VISUAL_SEARCH_ICON_ENABLED=false. The route registration
  // in routes/index.js still uses config.visualSearchEnabled.
  server.ext('onPreResponse', (request, h) => {
    const res = request.response;
    if (res && res.variety === 'view') {
      res.source.context = Object.assign({}, res.source.context, {
        visualSearchEnabled: !!config.visualSearchIconEnabled
      });
    }
    return h.continue;
  });

  cb(null, { server, elastic });
};

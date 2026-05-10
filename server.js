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

  server.views({
    engines: { html: { module: require('handlebars'), compileMode: 'sync' } },
    relativeTo: __dirname,
    path: './templates/pages',
    layout: 'default',
    layoutPath: './templates/layouts',
    partialsPath: './templates/partials',
    helpersPath: './templates/helpers'
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
  server.ext('onPreResponse', (request, h) => {
    const res = request.response;
    if (res && res.variety === 'view') {
      res.source.context = Object.assign({}, res.source.context, {
        visualSearchEnabled: !!config.visualSearchEnabled
      });
    }
    return h.continue;
  });

  cb(null, { server, elastic });
};

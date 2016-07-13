const test = require('tape');
const errorPlugin = require('../routes/plugins/error');
const Client = require('elasticsearch').Client;
const config = require('../config');
const elastic = new Client(config.elasticsearch);
config.port = 0;
const server = require('../server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Should build a query param object from a html request', (t) => {
  t.plan(1);
  const orig = errorPlugin.register;
  errorPlugin.register = function (server, options, next) {
    errorPlugin.register = orig;
    return next(new Error('register error plugin failed'));
  };

  errorPlugin.register.attributes = {
    name: 'Fake plugin'
  };

  server(elastic, config, (err, ctx) => {
    t.equal(err.message, 'register error plugin failed', 'Handle registration of a failed plugin');
    t.end();
  });
});

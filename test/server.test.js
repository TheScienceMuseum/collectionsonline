const test = require('tape');
const Client = require('elasticsearch').Client;
const config = require('../config');
const elastic = new Client(config.elasticsearch);
config.port = 0;
const server = require('../server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Should build a query param object from a html request', (t) => {
  t.plan(1);

  server(elastic, config, (err, ctx) => {
    t.notOk(err)
    t.end();
  });
});

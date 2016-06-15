var path = require('path');

module.exports = [
  {
    method: 'GET',
    path: '/',
    config: {
      plugins: {
        'hapi-negotiator': {
          mediaTypes: {
            'text/html': function (req, reply) {
              reply('<!doctype html><html><h1>HTML Response</h1><html>').header('content-type', 'text/html');
            },
            'application/vnd.api+json': function (req, reply) {
              reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
            }
          }
        }
      }
    },
    handler: function (req, reply) {
      reply('OK');
    }
  },
  {
    method: 'GET',
    path: '/{path*}',
    handler: function (req, reply) {
      reply.file(path.join(__dirname, 'public', req.params.path));
    }
  }
];

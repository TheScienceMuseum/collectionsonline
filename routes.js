const path = require('path');
const fs = require('fs');
const exampleData = JSON.parse(fs.readFileSync('./src/data/searchresults.json'));

module.exports = [
  {
    method: 'GET',
    path: '/',
    config: {
      plugins: {
        'hapi-negotiator': {
          mediaTypes: {
            'text/html': (req, reply) => {
              const pageView = req.query.view === 'list' ? 'results-list' : 'index';

              const data = {
                searchresults: exampleData,
                page: pageView,
                title: 'Search Results'
              };

              reply.view('index', data).header('content-type', 'text/html');
            },
            'application/vnd.api+json': (req, reply) => {
              reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
            }
          }
        }
      }
    },
    handler: (req, reply) => {
      reply('OK');
    }
  },
  {
    method: 'GET',
    path: '/{path*}',
    handler: (req, reply) => {
      reply.file(path.join(__dirname, 'public', req.params.path));
    }
  }
];

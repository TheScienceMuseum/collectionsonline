const fs = require('fs');
const Boom = require('boom');
const exampleData = JSON.parse(fs.readFileSync('./src/data/object.json'));
const buildJSONResponse = require('../lib/jsonapi-response');

module.exports = ({ elastic, config }) => ({
  method: 'GET',
  path: '/object/{id}/{slug?}',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = {
              page: 'object',
              title: 'Difference Engine No 1'
            };

            reply.view('object', Object.assign(exampleData, data));
          },
          'application/vnd.api+json' (req, reply) {
            elastic.get({index: 'smg', type: 'object', id: req.params.id}, (err, result) => {
              if (err) {
                return reply(err);
              }

              if (!result) {
                return reply(Boom.notFound('Object not found'));
              }

              reply(buildJSONResponse(result, config)).header('content-type', 'application/vnd.api+json');
            });
          }
        }
      }
    }
  }
});

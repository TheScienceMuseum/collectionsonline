const fs = require('fs');
const Boom = require('boom');
const exampleData = JSON.parse(fs.readFileSync('./src/data/object.json'));
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data.js');

module.exports = ({ elastic, config }) => ({
  method: 'GET',
  path: '/objects/{id}/{slug?}',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = {
              page: 'object',
              slides: exampleData.slides
            };

            elastic.get({index: 'smg', type: 'object', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
              if (err) {
                if (err.status === 404) {
                  return reply(Boom.notFound());
                }
                return reply(err);
              }

              const JSONData = buildJSONResponse(result, config);
              const HTMLData = JSONToHTML(JSONData);

              reply.view('object', Object.assign(HTMLData, data));
            });
          },
          'application/vnd.api+json' (req, reply) {
            elastic.get({index: 'smg', type: 'object', id: TypeMapping.toInternal(req.params.id)}, (err, result) => {
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

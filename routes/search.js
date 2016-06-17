const Joi = require('joi');
const filterSchema = require('../schemas/filter');
const fs = require('fs');
const exampleData = JSON.parse(fs.readFileSync('./src/data/searchresults.json'));

module.exports = ({ elastic }) => ({
  method: 'GET',
  path: '/search/{resource?}',
  handler: (request, reply) => reply(),
  config: {
    validate: {
      params: {
        resource: Joi.string().valid('objects', 'people', 'documents')
      },
      query: filterSchema.keys({
        q: Joi.string().required(),
        'page[number]': Joi.number().integer().min(0),
        'page[size]': Joi.number().integer().min(1),
        'fields[objects]': Joi.string(),
        'fields[people]': Joi.string(),
        'fields[documents]': Joi.string()
      })
    },
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            elastic.search({ q: request.query.q }, (err, result) => {
              if (err) return reply(err);
              console.log(result);

              const data = {
                searchresults: exampleData,
                page: 'index',
                title: 'Search Results'
              };

              reply.view('index', data);
            });
          },
          'application/vnd.api+json' (req, reply) {
            reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
          }
        }
      }
    }
  }
});

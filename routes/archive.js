const Boom = require('boom');
const Joi = require('joi');
const archiveSchema = require('../schemas/archive.js');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data.js');
const getChildArchives = require('../lib/get-child-files.js');
const sortRelated = require('../lib/sort-related-items');
const async = require('async');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/documents/{id}/{slug?}',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            Joi.validate(request.query, archiveSchema, (err, value) => {
              if (err) return reply(Boom.badRequest(err));

              const data = {
                page: 'archive'
              };

              elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
                if (err) {
                  if (err.status === 404) {
                    return reply(Boom.notFound());
                  }
                  return reply(Boom.serverUnavailable('unavailable'));
                }

                getChildArchives(elastic, request.params.id, function (err, children) {
                  if (err) {
                    children = {};
                  } else {
                    children = sortRelated(children, 'children');
                  }

                  const JSONData = buildJSONResponse(result, config, children);
                  const HTMLData = JSONToHTML(JSONData);

                  // Get nested children if 'expanded' exists as a query
                  if (value.expanded) {
                    async.map(value.expanded, function (id, callback) {
                      return getChildArchives(elastic, id, callback);
                    }, function (err, returned) {
                      if (err) console.log(err);

                      HTMLData.related.children.forEach((el, i) => {
                        var childMatch = value.expanded.findIndex(e => e === el.id);
                        if (childMatch > -1) {
                          el.children = sortRelated(returned[childMatch], 'children').relatedChildren;
                        }
                      });

                      reply.view('archive', Object.assign(HTMLData, data));
                    });
                  } else {
                    reply.view('archive', Object.assign(HTMLData, data));
                  }
                });
              });
            });
          },
          'application/vnd.api+json' (request, reply) {
            elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
              if (err) {
                return reply(err);
              }

              if (!result) {
                return reply(Boom.notFound('Document not found'));
              }

              getChildArchives(elastic, request.params.id, function (err, children) {
                if (err) {
                  children = {};
                } else {
                  children = sortRelated(children, 'children');
                }

                reply(buildJSONResponse(result, config, children)).header('content-type', 'application/vnd.api+json');
              });
            });
          }
        }
      }
    }
  }
});

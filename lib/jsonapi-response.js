const allAttributes = require('../fixtures/attributes');
const allRelationships = require('../fixtures/relationships');
const TypeMapping = require('./type-mapping');

module.exports = (data, config) => {
  const response = {};

  response.data = {};
  response.data.type = TypeMapping.toExternal(data._type);
  response.data.id = TypeMapping.toExternal(data._id);
  response.data.attributes = getAttributes(data._source);

  response.relationships = getRelationships(data._source);

  response.included = getIncluded(data._source, response, config);

  response.links = {};
  response.links.self = config.rootUrl + '/' + response.data.type + '/' + response.data.id;

  return response;
};

function getAttributes (data) {
  const attributes = {};

  allAttributes.forEach((key) => {
    if (data[key]) {
      attributes[key] = data[key];
    }
  });

  return attributes;
}

function getRelationships (data) {
  const relationships = {};

  allRelationships.forEach((key) => {
    if (data[key]) {
      relationships[key] = {data: []};

      data[key].forEach((el, i) => {
        let rel = {
          type: '',
          id: ''
        };

        rel.id = TypeMapping.toExternal(el.admin.uid);
        rel.type = TypeMapping.toExternal(el.admin.id.split('-')[0]);

        relationships[key].data.push(rel);
      });

      if (relationships[key].length === 1) {
        relationships[key] = relationships[key][0];
      }
    }
  });

  return relationships;
}

function getIncluded (data, response, config) {
  if (Object.keys(response.relationships).length) {
    const included = [];

    Object.keys(response.relationships).forEach((key) => {
      let resources = response.relationships[key];
      resources = resources.length ? resources : [resources];

      resources.forEach((res) => {
        const resource = {};

        resource.type = res.data.type;
        resource.id = res.data.id;

        resource.attributes = {};

        if (data[key].length) {
          data[key].forEach((el) => {
            Object.keys(el).forEach((key) => {
              if (key !== '@link' && key !== 'admin') {
                resource.attributes[key] = el[key];
              }
            });
          });
        }

        resource.links = {};
        resource.links.self = config.rootUrl + '/' + resource.type + '/' + resource.id;

        included.push(resource);
      });
    });

    return included;
  }
}

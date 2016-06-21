const attributesMap = require('../fixtures/attributes');
const relationshipsMap = require('../fixtures/relationships');
const config = require('../config');

module.exports = (data) => {
  const response = {};

  response.data = {};
  response.data.type = data._type;
  response.data.id = data._id;
  response.data.attributes = getAttributes(data._source);

  response.relationships = getRelationships(data._source);

  response.included = getIncluded(data._source, response);

  response.links = {};
  response.links.self = config.rootUrl + '/' + data._type + '/' + data._id;

  return JSON.stringify(response);
};

function getAttributes (data, dataType) {
  const attributes = {};

  Object.keys(data).forEach((key) => {
    if (attributesMap.indexOf(key) > -1) {
      attributes[key] = data[key];
    }
  });

  return attributes;
}

function getRelationships (data) {
  const relationships = {};

  Object.keys(data).forEach((key) => {
    if (relationshipsMap.indexOf(key) > -1) {
      relationships[key] = {data: []};

      data[key].forEach((el, i) => {
        let rel = {
          type: '',
          id: ''
        };

        rel.id = el.admin.uid;
        rel.type = el.admin.id.split('-')[0];

        relationships[key].data.push(rel);
      });

      if (relationships[key].length === 1) {
        relationships[key] = relationships[key][0];
      }
    }
  });

  return relationships;
}

function getIncluded (data, response) {
  if (response.relationships) {
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

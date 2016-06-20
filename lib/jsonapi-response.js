const attributesMap = require('../fixtures/attributes.js');
const relationshipsMap = require('../fixtures/relationships.js');

module.exports = (data) => {
  const response = {};

  response.data = {};
  response.data.type = data._type;
  response.data.id = data._id;
  response.data.attributes = getAttributes(data._source);

  response.relationships = getRelationships(data._source);

  response.links = {};
  response.links.self = 'http://www.sciencemuseum.org.uk/' + data._type + '/' + data._id;

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
      relationships[key] = [];

      data[key].forEach((el, i) => {
        let rel = {
          data: {
            type: '',
            id: '',
            attributes: {}
          },
          links: {}
        };

        rel.data.id = el.admin.uid;
        rel.data.type = el.admin.id.split('-')[0];

        rel.data.attributes.summary_title = el.summary_title;

        rel.links.related = 'http://www.sciencemuseum.org.uk/' + rel.data.type + '/' + rel.data.id;

        relationships[key].push(rel);
      });
    }
  });

  return relationships;
}

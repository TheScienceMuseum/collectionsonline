const allAttributes = require('../fixtures/attributes');
const allRelationships = require('../fixtures/relationships');
const TypeMapping = require('./type-mapping');

module.exports = (data, config) => {
  const response = {};

  response.data = {};
  response.data.type = TypeMapping.toExternal(data._type);
  response.data.id = TypeMapping.toExternal(data._id);
  response.data.attributes = getAttributes(data._source);

  response.relationships = getRelationships(data._source, response, config);

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

function getRelationships (data, response, config) {
  const relationships = {};

  allRelationships.forEach((key) => {
    if (data[key]) {
      relationships[key] = {data: []};

      data[key].forEach((el, i) => {
        let rel = {
          type: '',
          id: ''
        };

        if (el.admin) {
          rel.id = TypeMapping.toExternal(el.admin.uid);
          rel.type = TypeMapping.toExternal(el.admin.id.split('-')[0]);
          relationships[key].data.push(rel);
        }
      });

      if (!relationships[key].data.length) {
        delete relationships[key];
      }
    }
  });

  const creationDetails = getCreationDetails(data, config);

  if (creationDetails) {
    relationships.maker = creationDetails.makers;
    relationships.places = creationDetails.places;
  }

  if (Object.keys(relationships).length) {
    return relationships;
  }
}

function getIncluded (data, response, config) {
  if (response.relationships) {
    const included = [];

    Object.keys(response.relationships).forEach((key) => {
      let resources = response.relationships[key] || {data: []};

      resources.data.forEach((res) => {
        const resource = {};
        let originalResource;

        resource.type = res.type;
        resource.id = res.id;

        resource.attributes = {};

        if (key === 'maker' || key === 'places') {
          originalResource = data.lifecycle.creation[0][key];
        } else {
          originalResource = data[key];
        }

        originalResource.forEach((el) => {
          if (TypeMapping.toExternal(el.admin.uid) === resource.id) {
            Object.keys(el).forEach((key) => {
              if (key !== '@link' && key !== 'admin') {
                resource.attributes[key] = el[key];
              }
            });
          }
        });

        resource.links = {};
        resource.links.self = config.rootUrl + '/' + resource.type + '/' + resource.id;

        included.push(resource);
      });
    });

    return included;
  }
}

function getCreationDetails (data, config) {
  if (data.lifecycle && data.lifecycle.creation) {
    const makers = {data: []};
    const places = {data: []};

    data.lifecycle.creation.forEach((el) => {
      if (el.maker) {
        el.maker.forEach((el) => {
          const maker = {};

          if (el.admin) {
            maker.type = el.admin.id && TypeMapping.toExternal(el.admin.id.split('-')[0]);
            maker.id = TypeMapping.toExternal(el.admin.uid);
          }

          makers.data.push(maker);
        });
      }

      if (el.places) {
        el.places.forEach((el) => {
          const place = {};

          if (el.admin) {
            place.type = el.admin.id && TypeMapping.toExternal(el.admin.id.split('-')[0]);
            place.id = TypeMapping.toExternal(el.admin.uid);
          }

          places.data.push(place);
        });
      }
    });

    return { makers, places };
  }
}

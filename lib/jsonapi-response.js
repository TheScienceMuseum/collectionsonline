const allAttributes = require('../fixtures/attributes');
const allRelationships = require('../fixtures/relationships');
const TypeMapping = require('./type-mapping');

module.exports = (data, config) => {
  const type = TypeMapping.toExternal(data._type);
  const id = TypeMapping.toExternal(data._id);
  const attributes = getAttributes(data._source);
  const relationships = getRelationships(data._source);
  const links = {self: `${config.rootUrl}/${type}/${id}`};

  const included = getIncluded(data._source, relationships, config);

  return {data: {type, id, attributes, relationships, links}, included};
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
        var rel = {
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

  const creationDetails = getCreationDetails(data);

  if (creationDetails) {
    relationships.maker = creationDetails.makers;
    relationships.places = creationDetails.places;
  }

  if (Object.keys(relationships).length) {
    return relationships;
  }
}

function getIncluded (data, relationships, config) {
  if (relationships) {
    const included = [];

    Object.keys(relationships).forEach((key) => {
      var resources = relationships[key] || {data: []};

      resources.data.forEach((res) => {
        const resource = {};
        var originalResource;

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
        resource.links.self = `${config.rootUrl}/${resource.type}/${resource.id}`;

        included.push(resource);
      });
    });

    return included;
  }
}

function getCreationDetails (data) {
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

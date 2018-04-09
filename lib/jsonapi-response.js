const allAttributes = require('../fixtures/attributes');
const allRelationships = require('../fixtures/relationships');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');
const checkPurchased = require('./check-purchased');
const slug = require('slugg');
const sortImages = require('./helpers/jsonapi-response/sort-images.js');

module.exports = (data, config, relatedItems) => {
  const type = TypeMapping.toExternal(data._type);
  const id = TypeMapping.toExternal(data._id);
  const attributes = getAttributes(data._source);
  const relationships = getRelationships(data._source, relatedItems, type);
  const included = getIncluded(data._source, relationships, config, relatedItems, type);
  const links = getLinks(config, type, id, relationships);
  const inProduction = config && config.NODE_ENV === 'production';

  if (attributes.multimedia) {
    attributes.multimedia = getImagePaths(attributes, config);
    attributes.multimedia = sortImages(attributes.multimedia);
  }

  return {data: {type, id, attributes, links, relationships}, included, inProduction};
};

function getImagePaths (attributes, config) {
  var multimedia = attributes.multimedia;
  multimedia = multimedia.map(e => {
    if (e.processed) {
      var processed = e.processed;
      Object.keys(processed).forEach(k => {
        if (k === 'zoom') {
          processed[k].location = config.iiifPath + '%2Fs3-zooms/' + encodeURIComponent(processed[k].location) + '/info.json';
          processed[k].format = 'IIIF';
        } else {
          processed[k].location = config.mediaPath + processed[k].location;
        }

        delete processed[k].location_is_relative;
      });
      e.processed = processed;
    }
    return e;
  });

  return multimedia;
}

function getAttributes (data) {
  const attributes = {};

  allAttributes.forEach((key) => {
    if (data[key]) {
      attributes[key] = data[key];
      // temporary - restrict credit line if it contains 'Purchased'
      // https://github.com/TheScienceMuseum/collectionsonline/issues/195
      if (key === 'legal' && checkPurchased(attributes, key)) {
        delete attributes[key].credit_line;
      }
    }
  });

  return attributes;
}

function getLinks (config, type, id, relationships) {
  var links = {
    self: `${config.rootUrl}/${type}/${id}`,
    root: config.rootUrl,
    api: `${config.rootUrl}/api/${type}/${id}`
  };
  if (relationships && relationships.parent) {
    links.parent = `${config.rootUrl}/${relationships.parent.data[0].type}/${relationships.parent.data[0].id}`;
  }
  return links;
}

function getRelationships (data, relatedItems, type) {
  const relationships = {};

  allRelationships.forEach((key) => {
    const externalKey = TypeMapping.toExternal(key);

    if (data[key] || (data.content && data.content[key])) {
      var dk = data[key] || data.content[key];
      relationships[externalKey] = {data: []};

      dk.forEach((el, i) => {
        var rel = {
          type: '',
          id: ''
        };

        if (el.admin) {
          rel.id = TypeMapping.toExternal(el.admin.uid);
          rel.type = TypeMapping.toExternal(el.admin.id.split('-')[0]);
          relationships[externalKey].data.push(rel);
        }
      });
    }
  });

  const creationDetails = getCreationDetails(data);

  if (creationDetails) {
    relationships.maker = creationDetails.makers;
    relationships.places = creationDetails.places;
  }

  if (relatedItems && type === 'people') {
    relationships.objects = {};
    relationships.documents = {};
    relationships.objects.data = relatedItems.relatedObjects.map(returnRelationship);
    relationships.documents.data = relatedItems.relatedDocuments.map(returnRelationship);
  } else if (relatedItems && type === 'documents') {
    relationships.children = {};
    relationships.siblings = {};
    relationships.children.data = relatedItems.relatedChildren.map(returnRelationship);
    relationships.siblings.data = relatedItems.relatedSiblings.map(returnRelationship);
  } else if (relatedItems && type === 'objects') {
    relationships.objects = {};
    relationships.objects.data = relatedItems.relatedObjects.map(returnRelationship);
  }

  if (Object.keys(relationships).length) {
    return relationships;
  }
}

function returnRelationship (el) {
  return {
    type: el.type || TypeMapping.toExternal(el._type),
    id: el.id || TypeMapping.toExternal(el._id)
  };
}

function getIncluded (data, relationships, config, relatedItems, type) {
  if (relationships) {
    var included = [];
    Object.keys(relationships).forEach((key) => {
      var internalKey;
      if (key !== 'objects' && key !== 'children' && key !== 'siblings') {
        var resources = relationships[key] || {data: []};
        resources.data.forEach((res) => {
          var resource = {};
          var originalResource;

          resource.type = res.type;
          resource.id = res.id;

          resource.attributes = {};
          if (
            key === 'maker' || (key === 'places' &&
            getNestedProperty(data, 'lifecycle.creation.0.places') &&
            getNestedProperty(data, 'lifecycle.creation.0.places').some(el => {
              if (el.admin) {
                return el.admin.uid === res.id;
              }
            }))
          ) {
            originalResource = data.lifecycle.creation[0][TypeMapping.toInternal(key)];
            resource.attributes.role = {type: key};
          } else {
            if (key === 'people') {
              internalKey = 'agents';
            } else if (key === 'documents') {
              internalKey = 'archives';
            } else {
              internalKey = TypeMapping.toInternal(key);
            }
            originalResource = data[internalKey] || (data.content && data.content[internalKey]) || [];
          }

          originalResource.forEach((el) => {
            if (el.admin && TypeMapping.toExternal(el.admin.uid) === resource.id) {
              Object.keys(el).forEach((key) => {
                if (key !== '@link' && key !== 'admin') {
                  resource.attributes[key] = el[key];
                } else if (key === '@link' && el[key].role) {
                  resource.attributes.role = resource.attributes.role || {};
                  resource.attributes.role.value = el[key].role[0].value;
                }
              });
            }
          });

          resource.links = {};
          var slugValue = resource.attributes.summary_title && slug(resource.attributes.summary_title).toLowerCase();
          slugValue = slugValue ? ('/' + slugValue) : '';
          resource.links.self = config.rootUrl + '/' + resource.type + '/' + resource.id + slugValue;
          if (originalResource.length) included.push(resource);
        });
      }
    });

    if (relatedItems) {
      var allRelated = Object.keys(relatedItems).map(el => {
        return relatedItems[el];
      }).reduce((prev, curr) => {
        return prev.concat(curr);
      });
      included = included.concat(allRelated);
    }
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
            makers.data.push(maker);
          }
        });
      }

      if (el.places) {
        el.places.forEach((el) => {
          const place = {};
          if (el.admin) {
            place.type = el.admin.id && TypeMapping.toExternal(el.admin.id.split('-')[0]);
            place.id = TypeMapping.toExternal(el.admin.uid);
            places.data.push(place);
          }
        });
      }
    });

    return { makers, places };
  }
}

const allAttributes = require('../fixtures/attributes');
const allRelationships = require('../fixtures/relationships');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');
const checkPurchased = require('./check-purchased');
const displayLegalStatus = require('./display-legal-status');
const slug = require('slugg');
const sortImages = require('./helpers/jsonapi-response/sort-images.js');
// const { CloudFrontKeyValueStore } = require('aws-sdk');

module.exports = (data, config, relatedItems, childRecordsList) => {
  const type = TypeMapping.toExternal(data._source['@datatype']?.base);
  const record = getRecordType(data);
  const id = TypeMapping.toExternal(data._id);
  // fix for unit test
  let children = [];
  if (Array.isArray(childRecordsList)) {
    children = getChildRecords(data._source, childRecordsList, config);
  }
  const filteredEnhancements = filterAndExtractChildEnhancements(children);
  const hasChildEnhancements = !!filteredEnhancements;
  const attributes = getAttributes(data._source);
  const relationships = getRelationships(data._source, relatedItems, type);
  const counts = getDescendantCount(data._source);
  const included = getIncluded(
    data._source,
    relationships,
    config,
    relatedItems,
    type
  );

  const links = getLinks(
    config,
    type,
    id,
    relationships,
    attributes.summary?.title
  );
  const inProduction = config && config.NODE_ENV === 'production';

  if (attributes.multimedia) {
    attributes.multimedia = getImagePaths(attributes, config);
    attributes.multimedia = sortImages(attributes.multimedia);
  }

  // // Pull these child elements up onto the parent record
  // const pullupAttr = ['location', 'facility', 'ondisplay'];
  // pullupAttr.forEach((att) => {
  //   const pullUpValues = children
  //     .filter((child) => {
  //       return child.data.attributes[att];
  //     })
  //     .map((child) => {
  //       return child.data.attributes[att];
  //     });
  //   // console.log('current values: ', att, attributes[att]);
  //   // console.log('new values: ', att, pullUpValues);
  //   attributes[att] = pullUpValues;
  // });

  // remove internal fields
  delete attributes.options;

  if (!attributes.enhancement && hasChildEnhancements) {
    // console.log('enhancement block(s) pulled up from child record');
    attributes.enhancement = newParentEnhancement(data, filteredEnhancements);
  } else if (attributes.enhancement && hasChildEnhancements) {
    // console.log('enhancement block(s) pulled up from child record');
    attributes.enhancement.web = mergeEnhancementData(
      data,
      filteredEnhancements
    );
  }

  const ___comment =
    '### WARNING ### - <enhancement> tags are experimental, please do not aggregate';

  return {
    data: {
      ___comment,
      type,
      id,
      attributes,
      links,
      relationships,
      children,
      record,
      counts
    },
    included,
    inProduction
  };
};

function getImagePaths (attributes, config) {
  let multimedia = attributes.multimedia;
  multimedia = multimedia.map((e) => {
    if (e['@processed']) {
      const processed = e['@processed'];
      Object.keys(processed).forEach((k) => {
        if (k === 'zoom') {
          processed[k].location =
            config.iiifPath + encodeURIComponent(processed[k].location);
          processed[k].format = 'IIIF';
        } else {
          processed[k].location = config.mediaPath + processed[k].location;
        }

        delete processed[k].location_is_relative;
      });
      e['@processed'] = processed;
    }
    return e;
  });
  return multimedia;
}

function getAttributes (data) {
  const attributes = {};

  allAttributes.forEach((key) => {
    if (data && data[key]) {
      attributes[key] = data[key];
      // temporary - restrict credit line if it contains 'Purchased'
      // https://github.com/TheScienceMuseum/collectionsonline/issues/195
      if (key === 'legal' && checkPurchased(attributes, key)) {
        delete attributes[key].credit_line;
      }

      // temporary - restrict legal status if it contains 'Auxillary materials'
      if (key === 'legal' && displayLegalStatus(attributes, key)) {
        delete attributes[key].legal_status;
      }
    }
  });

  return attributes;
}

function getLinks (config, type, id, relationships, title) {
  const links = {
    self: `${config.rootUrl}/${type}/${id}/${slug(title).toLowerCase()}`,
    root: config.rootUrl,
    api: `${config.rootUrl}/api/${type}/${id}`,
    iiif: `${config.rootUrl}/iiif/${type}/${id}`
  };

  // Check where this is used and if needed? Is it only used on AdLib (child) documents?
  if (relationships && relationships.parent) {
    // add slug, value held in attributes.level.fonds for AdLib documents
    links.parent = `${config.rootUrl}/${relationships.parent.data[0].type}/${relationships.parent.data[0].id}`;
  }
  return links;
}

function getRelationships (data, relatedItems, type) {
  const relationships = {};
  allRelationships.forEach((key) => {
    const externalKey = TypeMapping.toExternal(key);

    if ((data && data[key]) || (data && data.content && data.content[key])) {
      const dk = data[key] || data.content[key];

      relationships[externalKey] = { data: [] };
      dk.forEach((el, i) => {
        const rel = {
          type: '',
          id: ''
        };
        if (el['@admin']) {
          rel.id = TypeMapping.toExternal(el['@admin'].uid);
          rel.type = TypeMapping.toExternal(el['@admin'].id.split('-')[0]);
          relationships[externalKey].data.push(rel);
        }
      });
    }
  });

  const creationDetails = getCreationDetails(data);

  if (creationDetails) {
    relationships.maker = creationDetails.makers;
    relationships.place = creationDetails.place;
  }

  if (relatedItems && type === 'people') {
    relationships.objects = {};
    relationships.documents = {};
    relationships.objects.data =
      relatedItems.relatedObjects.map(returnRelationship);
    relationships.documents.data =
      relatedItems.relatedDocuments.map(returnRelationship);
  } else if (relatedItems && type === 'documents') {
    relationships.children = {};
    relationships.siblings = {};
    relationships.children.data =
      relatedItems.relatedChildren.map(returnRelationship);
    relationships.siblings.data =
      relatedItems.relatedSiblings.map(returnRelationship);
  } else if (relatedItems && type === 'objects') {
    relationships.objects = {};

    relationships.objects.data =
      relatedItems.relatedObjects.map(returnRelationship);
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
    let included = [];
    Object.keys(relationships).forEach((key) => {
      let internalKey;
      if (key !== 'objects' && key !== 'children' && key !== 'siblings') {
        const resources = relationships[key] || { data: [] };
        resources.data.forEach((res) => {
          const resource = {};
          let originalResource;

          resource.type = res.type;
          resource.id = res.id;

          resource.attributes = {};
          if (
            key === 'maker' ||
            (key === 'place' &&
              getNestedProperty(data, 'creation.place') &&
              getNestedProperty(data, 'creation.place').some((el) => {
                if (el['@admin']) {
                  return el['@admin'].uid === res.id;
                } else {
                  return null;
                }
              }))
          ) {
            originalResource = data.creation[TypeMapping.toInternal(key)];
            resource.attributes.role = { type: key };
          } else {
            if (key === 'people') {
              internalKey = 'agent';
            } else if (key === 'documents') {
              internalKey = 'archive';
            } else if (key === 'mgroup') {
              internalKey = 'mgroup';
            } else {
              internalKey = TypeMapping.toInternal(key);
            }
            originalResource =
              data[internalKey] ||
              (data.content && data.content[internalKey]) ||
              [];
          }

          originalResource.forEach((el) => {
            if (
              el['@admin'] &&
              TypeMapping.toExternal(el['@admin'].uid) === resource.id
            ) {
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
          let slugValue =
            resource.attributes.summary_title &&
            slug(resource.attributes.summary_title).toLowerCase();
          slugValue = slugValue ? '/' + slugValue : '';
          resource.links.self =
            config.rootUrl +
            '/' +
            resource.type +
            '/' +
            resource.id +
            slugValue;
          if (originalResource.length) included.push(resource);
        });
      }
    });

    if (relatedItems) {
      const allRelated = Object.keys(relatedItems)
        .map((el) => {
          return relatedItems[el];
        })
        .reduce((prev, curr) => {
          return prev.concat(curr);
        });
      included = included.concat(allRelated);
    }
    return included;
  }
}

function getCreationDetails (data) {
  if (data && data.creation) {
    const makers = { data: [] };
    const place = { data: [] };

    data.creation.maker?.forEach((el) => {
      const maker = {};
      if (el['@admin']) {
        maker.type =
          el['@admin'].id &&
          TypeMapping.toExternal(el['@admin'].id.split('-')[0]);
        maker.id = TypeMapping.toExternal(el['@admin'].uid);
        makers.data.push(maker);
      }
    });

    data.creation.place?.forEach((el) => {
      const p = {};
      if (el['@admin']) {
        p.type =
          el['@admin'].id &&
          TypeMapping.toExternal(el['@admin'].id.split('-')[0]);
        p.id = TypeMapping.toExternal(el['@admin'].uid);
        place.data.push(p);
      }
    });

    return { makers, place };
  }
}

function getRecordType (data) {
  let record = {};
  let childRecordType = {};

  const groupingArray = data._source.grouping && data._source.grouping;

  // iterates over grouping array and checks if any are of type SPH
  if (groupingArray) {
    for (const item of groupingArray) {
      if (item['@link']?.type === 'SPH') {
        childRecordType = {
          groupingType: 'SPH',
          recordType: 'child'
        };
      }
    }
  }

  const parentRecord = {
    groupingType: TypeMapping.toExternal(
      data._source && data._source['@datatype']?.grouping
    ),
    recordType: 'parent'
  };

  record = childRecordType.groupingType ? childRecordType : parentRecord;

  return record;
}

function getChildRecords (data, childRecordsArr, config) {
  // transforms elastic search call for child records and merges with child array items on data object.
  //  A temp fix for missing properties on data.child. Involves two separate calls, so will have to monitor performance
  const children = data.child || [];
  const records = [...children];
  const parentType = data['@datatype']?.base;
  const childRecords =
    childRecordsArr.reduce((acc, record) => {
      const uid = record._source['@admin'].uid;
      acc[uid] = record;
      return acc;
    }, {}) || [];

  const childData = records
    .map((record) => {
      const uid = record['@admin'].uid;
      const match = childRecords[uid];

      if (match) {
        const {
          measurements,
          description,
          material,
          title,
          name,
          location,
          facility,
          ondisplay,
          summary,
          category,
          identifier
        } = match._source;
        const id = match._source['@admin'].uid;
        const searchType = parentType === 'group' ? parentType : 'object';
        const checkTitle = title ? title?.[0].value : summary?.title;
        const links = {
          self: `${config.rootUrl}/objects/${id}/${slug(
            checkTitle
          ).toLowerCase()}`,
          root: `${config.rootUrl}`
        };

        const creationDate = match._source.creation?.date;
        const enhancement = match._source.enhancement
          ? match._source.enhancement
          : '';

        let multimedia = match._source.multimedia;
        if (multimedia) {
          multimedia = getImagePaths({ multimedia }, config);
          multimedia = sortImages(multimedia);
        }

        const inProduction = config && config.NODE_ENV === 'production';

        const type = TypeMapping.toExternal(searchType);

        // adds nested child records recursively, checks if isn't MPH type first, which should have no nested children
        let nestedChildData;

        const subType = match._source['@datatype']?.sub;

        if (subType && subType !== 'MPH') {
          if (record.child) {
            const nestedChildRecords = record.child.map((child) => ({
              _source: child,
              '@admin': { uid: child['@admin'].uid }
            }));
            nestedChildData = getChildRecords(
              { child: nestedChildRecords },
              childRecordsArr,
              config
            );
            match._source.child = nestedChildData || [];
          }
        }

        return {
          data: {
            attributes: {
              ...record,
              measurements,
              description,
              material,
              name,
              title,
              location,
              facility,
              ondisplay,
              multimedia,
              category,
              creationDate,
              identifier,
              links,
              enhancement,
              summary,
              children: nestedChildData || []
            },
            type,
            inProduction
          }
        };
      } else {
        return null;
      }
    })
    .filter(Boolean);
  return childData;
}

function getDescendantCount (data) {
  return data?.counts || '';
}

// pulls up enhancement blocks from child records and either merges into or becomes parent enhancement block as if own data

function filterAndExtractChildEnhancements (childRecords) {
  // filters any enhancement blocks on child records
  const childRecordEnhancements = childRecords
    .filter((child) => {
      const { enhancement } = child.data.attributes;
      return enhancement;
    })
    .map((child) => {
      return { web: child.data.attributes.enhancement.web };
    });
  // merges filtered
  const groupedByWeb = childRecordEnhancements
    ? childRecordEnhancements.reduce((acc, curr) => {
      return acc.concat(curr.web);
    }, [])
    : '';
  if (!groupedByWeb || groupedByWeb.length === 0) {
    return null;
  }

  return { web: groupedByWeb };
}

function newParentEnhancement (data, filtered) {
  if (!data._source.enhancement) {
    // If no enhancement on parent, populate it with groupedByWeb
    return filtered;
  }
}

// To handle merging existing enhancement blocks on parent with any child record enhancements
function mergeEnhancementData (data, filtered) {
  const { web } = filtered;

  let existingEnhancement = [...data._source.enhancement.web];
  web?.forEach((item) => {
    existingEnhancement = [...existingEnhancement, item];
  });
  return existingEnhancement;
}

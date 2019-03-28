const config = require('../config');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');
const getPrimaryValue = require('./get-primary-value');
const slug = require('slugg');

module.exports = (related, id) => {
  var sortedRelated = {
    object: [],
    archive: [],
    children: [],
    siblings: []
  };

  related.forEach(el => {
    var group = el._type;
    var slugValue = el._source.summary_title && slug(el._source.summary_title).toLowerCase();
    slugValue = slugValue ? ('/' + slugValue) : '';
    if (sortedRelated[group]) {
      var figure = getNestedProperty(el, '_source.multimedia.0.processed.medium_thumbnail.location');
      let item = {
        id: TypeMapping.toExternal(el._id),
        type: TypeMapping.toExternal(el._type),
        attributes: {
          summary_title: el._source.summary_title,
          level: getNestedProperty(el, '_source.level.value'),
          identifier: getPrimaryValue(el._source.identifier),
          figure: figure ? config.mediaPath + figure : null
        },
        link: config.rootUrl + '/' + TypeMapping.toExternal(el._type) + '/' + TypeMapping.toExternal(el._id) + slugValue
      };

      if (id) { item.role = getCreationRole(el, id); }

      sortedRelated[group].push(item);
    }
  });

  return {
    relatedObjects: sortedRelated.object,
    relatedDocuments: sortedRelated.archive,
    relatedChildren: sortedRelated.children,
    relatedSiblings: sortedRelated.siblings
  };
};

function getCreationRole (item, id) {
  const creation = (getNestedProperty(item, '_source.lifecycle.creation') || []).find(el => {
    if (Array.isArray(el.maker)) {
      return el.maker.some(e => e.admin.uid === id);
    }
  });

  if (creation && Array.isArray(creation.maker)) {
    const maker = creation.maker.find(el => el.admin.uid === id);

    if (maker['@link']) {
      return getPrimaryValue(maker['@link'].role);
    }
  } else {
    return getAssociatedRole(item, id);
  }

  return null;
}

function getAssociatedRole (item, id) {
  const association = (getNestedProperty(item, '_source.agents') || []).find(el => {
    return el.admin.uid === id;
  });

  if (association && association['@link']) {
    return getPrimaryValue(association['@link'].role);
  }

  return null;
}

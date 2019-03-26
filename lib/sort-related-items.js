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

      if (id) { item.role = getRole(el, id); }

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

function getRole (item, id) {
  const creation = (getNestedProperty(item, '_source.lifecycle.creation') || []).find(el => {
    return el.maker.some(e => e.admin.uid === id);
  });

  const maker = creation.maker.find(el => el.admin.uid === id) || { '@link': {} };

  return getPrimaryValue(maker['@link'].role);
}

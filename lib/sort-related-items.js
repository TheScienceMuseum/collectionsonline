const config = require('../config');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');
const getPrimaryValue = require('./get-primary-value');
const slug = require('slug');

module.exports = (related, type) => {
  var sortedRelated = {
    object: [],
    archive: [],
    children: [],
    siblings: []
  };

  related.forEach(el => {
    var group = type || el._type;
    var slugValue = el._source.summary_title && slug(el._source.summary_title, {lower: true});
    slugValue = slugValue ? ('/' + slugValue) : '';
    if (sortedRelated[group]) {
      var figure = getNestedProperty(el, '_source.multimedia.0.processed.medium_thumbnail.location');
      sortedRelated[group].push({
        id: TypeMapping.toExternal(el._id),
        type: TypeMapping.toExternal(el._type),
        attributes: {
          summary_title: el._source.summary_title,
          level: getNestedProperty(el, '_source.level.value'),
          identifier: getPrimaryValue(el._source.identifier),
          figure: figure ? config.mediaPath + figure : null
        },
        link: config.rootUrl + '/' + TypeMapping.toExternal(el._type) + '/' + TypeMapping.toExternal(el._id) + slugValue
      });
    }
  });

  return {
    relatedObjects: sortedRelated.object,
    relatedDocuments: sortedRelated.archive,
    relatedChildren: sortedRelated.children,
    relatedSiblings: sortedRelated.siblings
  };
};

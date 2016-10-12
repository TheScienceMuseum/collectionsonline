const config = require('../config');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');
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
    sortedRelated[group].push({
      id: TypeMapping.toExternal(el._id),
      type: TypeMapping.toExternal(el._type),
      attributes: {
        summary_title: el._source.summary_title,
        level: getNestedProperty(el, '_source.level.value'),
        identifier: getNestedProperty(el, '_source.identifier.0.value')
      },
      link: config.rootUrl + '/' + TypeMapping.toExternal(el._type) + '/' + TypeMapping.toExternal(el._id) + slugValue
    });
  });

  return {
    relatedObjects: sortedRelated.object,
    relatedDocuments: sortedRelated.archive,
    relatedChildren: sortedRelated.children,
    relatedSiblings: sortedRelated.siblings
  };
};

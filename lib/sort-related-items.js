const config = require('../config');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');

module.exports = (related, type) => {
  var sortedRelated = {
    object: [],
    archive: [],
    children: []
  };

  related.forEach(el => {
    var group = type || el._type;
    sortedRelated[group].push({
      id: TypeMapping.toExternal(el._id),
      type: TypeMapping.toExternal(el._type),
      attributes: {
        summary_title: el._source.summary_title,
        level: getNestedProperty(el, '_source.level.value'),
        identifier: getNestedProperty(el, '_source.identifier.0.value')
      },
      link: config.rootUrl + '/' + TypeMapping.toExternal(el._type) + '/' + TypeMapping.toExternal(el._id)
    });
  });

  return {
    relatedObjects: sortedRelated.object,
    relatedDocuments: sortedRelated.archive,
    relatedChildren: sortedRelated.children
  };
};

const config = require('../config');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');

module.exports = (related, type) => {
  var sortedRelated = {
    object: [],
    archive: [],
    children: [],
    siblings: []
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
    relatedChildren: sortedRelated.children.sort(sortByIdentifier),
    relatedSiblings: sortedRelated.siblings.sort(sortByIdentifier)
  };
};

function sortByIdentifier (a, b) {
  var aIdentifier = a.attributes.identifier;
  var bIdentifier = b.attributes.identifier;

  if (aIdentifier < bIdentifier) {
    return -1;
  }
  if (aIdentifier > bIdentifier) {
    return 1;
  }

  return 0;
}

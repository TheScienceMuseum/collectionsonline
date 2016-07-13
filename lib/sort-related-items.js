const config = require('../config');
const TypeMapping = require('./type-mapping');

module.exports = (related, type) => {
  var sortedRelated = {
    object: [],
    archive: []
  };

  related.forEach(el => {
    sortedRelated[el._type].push({
      id: TypeMapping.toExternal(el._id),
      type: TypeMapping.toExternal(el._type),
      summary_title: el._source.summary_title,
      link: config.rootUrl + '/' + TypeMapping.toExternal(el._type) + '/' + TypeMapping.toExternal(el._id)
    });
  });

  return {
    relatedObjects: sortedRelated.object,
    relatedDocuments: sortedRelated.archive
  };
};

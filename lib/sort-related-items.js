const config = require('../config');
const TypeMapping = require('./type-mapping');

module.exports = (related, type) => {
  var sortedRelated = {
    object: [],
    archive: []
  };

  related.forEach(el => {
    console.log(el._type);
    sortedRelated[el._type].push({
      type: el._type,
      summary_title: el._source.summary_title,
      link: config.rootUrl + '/' + TypeMapping.toExternal(el._type) + '/' + TypeMapping.toExternal(el._id)
    });
  });

  return {
    relatedObjects: sortedRelated.object,
    relatedDocuments: sortedRelated.archive
  };
};

const TypeMapping = require('../lib/type-mapping');

module.exports = (elastic, queryParams, cb) => {
  const must = [{
    match_phrase_prefix: {
      summary_title_text: { query: queryParams.q }
    }
  }];

  if (queryParams.type) {
    must.push({
      term: { 'type.base': TypeMapping.toInternal(queryParams.type) }
    });
  }

  const searchOpts = {
    searchName: 'autocomplete',
    index: 'smg',
    size: queryParams.size || 3,
    _source: ['summary_title'],
    body: {
      query: {
        bool: {
          must,
          filter: {
            terms: { 'type.base': ['agent', 'archive', 'object'] }
          }
        }
      }
    }
  };

  elastic.search(searchOpts, cb);
};

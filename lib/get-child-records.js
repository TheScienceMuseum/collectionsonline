const TypeMapping = require('./type-mapping.js');
const config = require('../config');

// gets child records under a parent by checking parent uid and whether child record is part of SPH
module.exports = async (elastic, id, count, groupingType) => {
  if (!groupingType) {
    return [];
  }
  const body = {
    // size: groupingType === 'MPH' ? 10000 : count,
    size: 10000,
    query: {
      bool: {
        filter: [
          {
            term: {
              'grouping.@admin.uid': TypeMapping.toInternal(id)
            }
          },
          {
            term: {
              'grouping.@link.type': groupingType
            }
          }
        ]
      }
    },
    sort: [
      {
        'identifier.value': {
          order: 'asc'
        }
      }
    ]
  };

  const searchOpts = {
    index: config.elasticIndex,
    body,
    _source: [
      '@admin',
      '@datatype',
      'measurements',
      'component',
      'description',
      'material',
      'title',
      'name',
      'location',
      'facility',
      'ondisplay',
      'summary',
      'category',
      'identifier',
      'multimedia',
      'enhancement',
      'creation',
      'child',
      'grouping'
    ]
  };

  const result = await elastic.search(searchOpts, { requestTimeout: 5000 });
  return result.body.hits.hits;
};

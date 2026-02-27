const TypeMapping = require('./type-mapping.js');

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
    index: 'ciim',
    body
  };

  try {
    const result = await elastic.search(searchOpts);
    return result.body.hits.hits;
  } catch (error) {
    console.error(`failed to fetch child records: ${error}`);
    throw error;
  }
};

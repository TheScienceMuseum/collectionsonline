/**
* Create the aggregation which give the number of result per categories depending on the selected filters
*/

module.exports = function (filters) {
  const aggregationTotalCategories = {
    filter: {
      bool: {
        must: filters.type
      }
    },
    aggs: {
      all: {
        filter: {
          bool: {
            must: filters.all
          }
        },
        aggs: {
          all_total: {
            terms: {field: 'type.base'}
          }
        }
      },
      people: {
        filter: {
          bool: {
            must: filters.people.concat([{term: { 'type.base': 'agent' }}])
          }
        },
        aggs: {
          people_total: {
            value_count: {field: 'admin.id'}
          }
        }
      },
      objects: {
        filter: {
          bool: {
            must: filters.objects.concat([{term: { 'type.base': 'object' }}])
          }
        },
        aggs: {
          objects_total: {
            value_count: {field: 'admin.id'}
          }
        }
      },
      documents: {
        filter: {
          bool: {
            must: filters.documents.concat([{term: { 'type.base': 'archive' }}])
          }
        },
        aggs: {
          documents_total: {
            value_count: {field: 'admin.id'}
          }
        }
      }
    }
  };
  return aggregationTotalCategories;
};

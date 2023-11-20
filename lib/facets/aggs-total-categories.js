/**
* Create the aggregation which give the number of result per categories depending on the selected filters
*/

module.exports = function (filters) {
  const aggregationTotalCategories = {
    total_categories: {
      filter: {
        bool: {
          must: filters.type
        }
      },
      aggs: {
        all: {
          filter: filters.all,
          aggs: {
            all_total: {
              terms: {field: '@datatype.base'}
            }
          }
        },
        people: {
          filter: filters.people,
          aggs: {
            people_total: {
              value_count: {field: '@admin.id'}
            }
          }
        },
        objects: {
          filter: filters.objects,
          aggs: {
            objects_total: {
              value_count: {field: '@admin.id'}
            }
          }
        },
        documents: {
          filter: filters.documents,
          aggs: {
            documents_total: {
              value_count: {field: '@admin.id'}
            }
          }
        }
      }
    }
  };
  return aggregationTotalCategories;
};

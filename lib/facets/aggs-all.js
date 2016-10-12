const filter = require('./create-filters');

module.exports = function (queryParams) {
  const aggregationObjects = {
    filter: {
      bool: {
        should: [
          { term: {'type.base': 'agent'} },
          { term: {'type.base': 'object'} },
          { term: {'type.base': 'archive'} }
        ]
      }
    },
    aggs: {
      category: {
        filter: filter(queryParams),
        aggs: {
          category_filters: {
            terms: { field: 'categories.name' }
          }
        }
      },
      maker: {
        filter: filter(queryParams),
        aggs: {
          maker_filters: {
            terms: { field: 'lifecycle.creation.maker.name.value' }
          }
        }
      },
      type: {
        filter: filter(queryParams),
        aggs: {
          type_filters: {
            terms: { field: 'name.value' }
          }
        }
      },
      place: {
        filter: filter(queryParams),
        aggs: {
          place_filters: {
            terms: { field: 'lifecycle.creation.places.summary_title' }
          }
        }
      },
      user: {
        filter: filter(queryParams),
        aggs: {
          user_filters: {
            terms: { field: 'agents.summary_title' }
          }
        }
      },
      archive: {
        filter: filter(queryParams),
        aggs: {
          archive_filters: {
            terms: { field: 'fonds.summary_title' }
          }
        }
      },
      occupation: {
        filter: filter(queryParams),
        aggs: {
          occupation_filters: {
            terms: {field: 'occupation'}
          }
        }
      },
      place_born: {
        filter: filter(queryParams),
        aggs: {
          place_born_filters: {
            terms: {field: 'lifecycle.birth.location.name.value'}
          }
        }
      },
      organisation: {
        filter: filter(queryParams),
        aggs: {
          organisations_filters: {
            terms: {field: 'type.sub_type'}
          }
        }
      },
      count: {
        filter: filter(queryParams),
        aggs: {
          count_filters: {
            value_count: {field: 'admin.id'}
          }
        }
      },
      material: {
        filter: filter(queryParams),
        aggs: {
          material_filters: {
            terms: { field: 'materials' }
          }
        }
      }
    }
  };

  return aggregationObjects;
};

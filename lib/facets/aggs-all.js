const filter = require('./create-filters');
const typeMapping = require('../type-mapping');

module.exports = function (queryParams) {
  // Call filter() once and reuse — avoids 16+ redundant calls per request
  const activeFilter = filter(queryParams);
  const activeFilterClauses = activeFilter.bool.filter;
  // Use match_all when no user filters are active rather than an empty bool wrapper
  const filterQuery = activeFilterClauses.length ? activeFilter : { match_all: {} };

  const aggregationObjects = {
    filter: {
      bool: {
        filter: [
          { terms: { '@datatype.base': ['agent', 'object', 'archive', 'group'] } }
        ],
        must_not: [
          {
            terms: {
              'grouping.@link.type': ['SPH']
            }
          }
        ]
      }
    },
    aggs: {
      category: {
        filter: filterQuery,
        aggs: {
          category_filters: {
            terms: { size: 20, field: 'category.name.keyword' }
          }
        }
      },
      collection: {
        filter: {
          bool: {
            filter: activeFilterClauses,
            must_not: {
              terms: {
                'cumulation.collector.summary.title.keyword': [
                  'Unknown',
                  'Unknown collector'
                ]
              }
            }
          }
        },
        aggs: {
          collection_filters: {
            terms: {
              size: 20,
              field: 'cumulation.collector.summary.title.keyword'
            }
          }
        }
      },
      subgroup: {
        filter: {
          bool: {
            filter: activeFilterClauses
          }
        },
        aggs: {
          sub_group_filters: {
            terms: {
              field: 'subgroup.summary.title.keyword'
            }
          }
        }
      },
      maker: {
        filter: {
          bool: {
            filter: activeFilterClauses,
            must_not: {
              terms: {
                'creation.maker.summary.title.keyword': [
                  'Unknown maker',
                  'Unknown photographer'
                ]
              }
            }
          }
        },
        aggs: {
          maker_filters: {
            terms: { field: 'creation.maker.summary.title.keyword' }
          }
        }
      },
      object_type: {
        filter: {
          bool: {
            filter: activeFilterClauses.concat({
              term: { '@datatype.base': 'object' }
            })
          }
        },
        aggs: {
          object_type_filters: {
            terms: { field: 'name.value.keyword' }
          }
        }
      },
      place: {
        filter: filterQuery,
        aggs: {
          place_filters: {
            terms: { field: 'creation.place.summary.title.keyword' }
          }
        }
      },
      user: {
        filter: filterQuery,
        aggs: {
          user_filters: {
            terms: { field: 'agent.summary.title.keyword' }
          }
        }
      },
      archive: {
        filter: filterQuery,
        aggs: {
          archive_filters: {
            terms: { size: 100, field: 'fonds.summary.title.keyword' }
          }
        }
      },
      occupation: {
        filter: filterQuery,
        aggs: {
          occupation_filters: {
            terms: { field: 'occupation.value.keyword' }
          }
        }
      },
      place_born: {
        filter: filterQuery,
        aggs: {
          place_born_filters: {
            terms: { field: 'birth.location.name.value.keyword' }
          }
        }
      },
      organisation: {
        filter: filterQuery,
        aggs: {
          organisations_filters: {
            terms: { field: '@datatype.actual' }
          }
        }
      },
      count: {
        filter: filterQuery,
        aggs: {
          count_filters: {
            value_count: { field: '@admin.id' }
          }
        }
      },
      material: {
        filter: filterQuery,
        aggs: {
          material_filters: {
            terms: { field: 'material.value.keyword' }
          }
        }
      },
      mphc: {
        filter: filterQuery,
        aggs: {
          mphc_filters: {
            terms: { field: 'parent.@admin.uid' }
          }
        }
      },
      museum: {
        filter: filterQuery,
        aggs: {
          museum_filters: {
            terms: { size: 100, field: 'ondisplay.value.keyword' }
          }
        }
      },
      gallery: {
        filter: filterQuery,
        aggs: {
          gallery_filters: {
            terms: { size: 100, field: 'ondisplay.value.keyword' }
          }
        }
      },
      image_license: {
        filter: {
          bool: {
            filter: imageAggs(queryParams, activeFilterClauses)
          }
        },
        aggs: {
          image_license_filters: {
            terms: {
              field: 'multimedia.legal.rights.licence'
            }
          }
        }
      },
      has_image: {
        filter: {
          bool: {
            filter: imageAggs(queryParams, activeFilterClauses)
          }
        },
        aggs: {
          has_image_filters: {
            terms: { field: 'multimedia.@admin.source' }
          }
        }
      }
    }
  };
  return aggregationObjects;
};

function imageAggs (qp, filterClauses) {
  if (qp.type !== 'all') {
    return filterClauses.concat({
      term: { '@datatype.base': typeMapping.toInternal(qp.type) }
    });
  } else {
    return filterClauses;
  }
}

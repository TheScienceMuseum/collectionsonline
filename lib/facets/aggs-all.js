const filter = require('./create-filters');
const typeMapping = require('../type-mapping');

module.exports = function (queryParams) {
  // Call filter() once and reuse — avoids 16+ redundant calls per request
  const activeFilter = filter(queryParams);
  const activeFilterClauses = activeFilter.bool.filter;
  // Use match_all when no user filters are active rather than an empty bool wrapper
  const filterQuery = activeFilterClauses.length ? activeFilter : { match_all: {} };

  // Scope maker/place aggregations to the current page's record type so that e.g.
  // archive makers don't appear as options on the objects tab (and vice versa).
  const typeToBase = { objects: 'object', people: 'agent', documents: 'archive', group: 'group' };
  const pageBaseType = typeToBase[queryParams.type];
  const typeScoped = pageBaseType
    ? activeFilterClauses.concat([{ term: { '@datatype.base': pageBaseType } }])
    : activeFilterClauses;

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
            // size: 20 — categories are well-controlled vocabulary; 20 covers all common values
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
            // size: 20 — keeps the facet list manageable in the UI
            terms: {
              size: 20,
              field: 'cumulation.collector.summary.title.keyword',
              exclude: '.*;.*'
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
            terms: { field: 'subgroup.summary.title.keyword', exclude: '.*;.*' }
          }
        }
      },
      maker: {
        filter: {
          bool: {
            filter: typeScoped,
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
            terms: { field: 'creation.maker.summary.title.keyword', exclude: '.*;.*' }
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
            terms: { field: 'name.value.keyword', exclude: '.*;.*' }
          }
        }
      },
      place: {
        filter: typeScoped.length ? { bool: { filter: typeScoped } } : { match_all: {} },
        aggs: {
          place_filters: {
            terms: { field: 'creation.place.summary.title.keyword', exclude: '.*;.*' }
          }
        }
      },
      user: {
        filter: filterQuery,
        aggs: {
          user_filters: {
            terms: { field: 'agent.summary.title.keyword', exclude: '.*;.*' }
          }
        }
      },
      archive: {
        filter: filterQuery,
        aggs: {
          archive_filters: {
            // size: 100 — fonds (archive collections) are more numerous than categories;
            // 100 ensures all active fonds appear as filter options
            terms: { size: 100, field: 'fonds.summary.title.keyword', exclude: '.*;.*' }
          }
        }
      },
      occupation: {
        filter: filterQuery,
        aggs: {
          occupation_filters: {
            terms: { field: 'occupation.value.keyword', exclude: '.*;.*' }
          }
        }
      },
      place_born: {
        filter: filterQuery,
        aggs: {
          place_born_filters: {
            terms: { field: 'birth.place.name.value.keyword', exclude: '.*;.*' }
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
            terms: { field: 'material.value.keyword', exclude: '.*;.*' }
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
            // size: 100 — museum/gallery values are numerous; 100 ensures all locations appear.
            // Both museum and gallery aggregations query the same ondisplay.value.keyword field;
            // the UI layer separates them into museum-level vs gallery-level display.
            terms: { size: 100, field: 'ondisplay.value.keyword', exclude: '.*;.*' }
          }
        }
      },
      gallery: {
        filter: filterQuery,
        aggs: {
          gallery_filters: {
            // size: 100 — see museum comment above
            terms: { size: 100, field: 'ondisplay.value.keyword', exclude: '.*;.*' }
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

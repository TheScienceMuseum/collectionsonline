const filter = require('./create-filters');
const typeMapping = require('../type-mapping');

module.exports = function (queryParams) {
  const aggregationObjects = {
    filter: {
      bool: {
        should: [
          { term: { '@datatype.base': 'agent' } },
          { term: { '@datatype.base': 'object' } },
          { term: { '@datatype.base': 'archive' } },
          { term: { '@datatype.base': 'group' } }
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
        filter: filter(queryParams),
        aggs: {
          category_filters: {
            terms: { size: 20, field: 'category.name.keyword' }
          }
        }
      },
      collection: {
        filter: {
          bool: {
            must: filter(queryParams).bool.must,
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
            must: filter(queryParams).bool.must
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
            must: filter(queryParams).bool.must,
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
            must: filter(queryParams).bool.must.concat({
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
        filter: filter(queryParams),
        aggs: {
          place_filters: {
            terms: { field: 'creation.place.summary.title.keyword' }
          }
        }
      },
      user: {
        filter: filter(queryParams),
        aggs: {
          user_filters: {
            terms: { field: 'agent.summary.title.keyword' }
          }
        }
      },
      archive: {
        filter: filter(queryParams),
        aggs: {
          archive_filters: {
            terms: { size: 100, field: 'fonds.summary.title.keyword' }
          }
        }
      },
      occupation: {
        filter: filter(queryParams),
        aggs: {
          occupation_filters: {
            terms: { field: 'occupation.value.keyword' }
          }
        }
      },
      place_born: {
        filter: filter(queryParams),
        aggs: {
          place_born_filters: {
            terms: { field: 'birth.location.name.value.keyword' }
          }
        }
      },
      organisation: {
        filter: filter(queryParams),
        aggs: {
          organisations_filters: {
            terms: { field: '@datatype.actual' }
          }
        }
      },
      count: {
        filter: filter(queryParams),
        aggs: {
          count_filters: {
            value_count: { field: '@admin.id' }
          }
        }
      },
      material: {
        filter: filter(queryParams),
        aggs: {
          material_filters: {
            terms: { field: 'material.value.keyword' }
          }
        }
      },
      mphc: {
        filter: filter(queryParams),
        aggs: {
          mphc_filters: {
            terms: { field: 'parent.@admin.uid' }
          }
        }
      },
      museum: {
        filter: filter(queryParams),
        aggs: {
          museum_filters: {
            terms: { size: 100, field: 'ondisplay.value.keyword' }
          }
        }
      },
      gallery: {
        filter: filter(queryParams),
        aggs: {
          gallery_filters: {
            terms: { size: 100, field: 'ondisplay.value.keyword' }
          }
        }
      },
      image_license: {
        filter: {
          bool: {
            must: imageAggs(queryParams)
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
            must: imageAggs(queryParams)
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

function imageAggs (qp) {
  if (qp.type !== 'all') {
    return filter(qp).bool.must.concat({
      term: { '@datatype.base': typeMapping.toInternal(qp.type) }
    });
  } else {
    return filter(qp);
  }
}

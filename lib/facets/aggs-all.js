const filter = require('./create-filters');
const typeMapping = require('../type-mapping');

module.exports = function (queryParams) {
  const aggregationObjects = {
    filter: {
      bool: {
        should: [
          { term: { 'type.base': 'agent' } },
          { term: { 'type.base': 'object' } },
          { term: { 'type.base': 'archive' } }
        ]
      }
    },
    aggs: {
      category: {
        filter: filter(queryParams),
        aggs: {
          category_filters: {
            terms: { size: 20, field: 'categories.name' }
          }
        }
      },
      collection: {
        filter: {
          bool: {
            must: filter(queryParams).bool.must,
            must_not: { terms: { 'lifecycle.collection.collector.summary_title': ['Unknown', 'Unknown collector'] } }
          }
        },
        aggs: {
          collection_filters: {
            terms: { size: 20, field: 'lifecycle.collection.collector.summary_title' }
          }
        }
      },
      maker: {
        filter: {
          bool: {
            must: filter(queryParams).bool.must,
            must_not: { terms: { 'lifecycle.creation.maker.summary_title': ['Unknown maker', 'Unknown photographer'] } }
          }
        },
        aggs: {
          maker_filters: {
            terms: { field: 'lifecycle.creation.maker.summary_title' }
          }
        }
      },
      object_type: {
        filter: {
          bool: {
            must: filter(queryParams).bool.must.concat({ term: { 'type.base': 'object' } })
          }
        },
        aggs: {
          object_type_filters: {
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
            terms: { field: 'fonds.summary_title.keyword' }
          }
        }
      },
      occupation: {
        filter: filter(queryParams),
        aggs: {
          occupation_filters: {
            terms: { field: 'occupation.keyword' }
          }
        }
      },
      place_born: {
        filter: filter(queryParams),
        aggs: {
          place_born_filters: {
            terms: { field: 'lifecycle.birth.location.name.value' }
          }
        }
      },
      organisation: {
        filter: filter(queryParams),
        aggs: {
          organisations_filters: {
            terms: { field: 'type.sub_type' }
          }
        }
      },
      count: {
        filter: filter(queryParams),
        aggs: {
          count_filters: {
            value_count: { field: 'admin.id' }
          }
        }
      },
      material: {
        filter: filter(queryParams),
        aggs: {
          material_filters: {
            terms: { field: 'materials.keyword' }
          }
        }
      },
      museum: {
        filter: filter(queryParams),
        aggs: {
          museum_filters: {
            terms: { size: 25, field: 'locations.name.value' }
          }
        }
      },
      gallery: {
        filter: filter(queryParams),
        aggs: {
          gallery_filters: {
            terms: { size: 30, field: 'locations.name.value' }
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
            terms: { field: 'multimedia.source.legal.rights.usage_terms.keyword' }
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
            terms: { field: 'multimedia.publish.keyword' }
          }
        }
      }
    }
  };

  return aggregationObjects;
};

function imageAggs (qp) {
  if (qp.type !== 'all') {
    return filter(qp).bool.must.concat({ term: { 'type.base': typeMapping.toInternal(qp.type) } });
  } else {
    return filter(qp);
  }
}

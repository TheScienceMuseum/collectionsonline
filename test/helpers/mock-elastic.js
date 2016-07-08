// Create a mock elasticsearch client with noop functions
module.exports = () => ({
  search: function () {
    const cb = arguments[arguments.length - 1];

    cb(null, {
      took: 0,
      timed_out: false,
      _shards: {
        total: 1,
        successful: 1,
        failed: 0
      },
      hits: {
        total: 0,
        max_score: null,
        hits: []
      },
      aggregations: {
        total: { doc_count: 0, total: { value: 0 } },
        total_per_categories: {
          doc_count_error_upper_bound: 0,
          sum_other_doc_count: 0,
          buckets: [
            { key: 'object', doc_count: 0 },
            { key: 'agent', doc_count: 0 },
            { key: 'term', doc_count: 0 },
            { key: 'archive', doc_count: 0 },
            { key: 'place', doc_count: 0 }
          ]
        },
        people: {
          occupation: {
            occupation_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'mathematician', doc_count: 2 },
                { key: 'engineer', doc_count: 1 }
              ]
            }
          },
          place_born: {
            place_born_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'London', doc_count: 2 },
                { key: 'Toulouse', doc_count: 1 }
              ]
            }
          },
          organisation: {
            organisations_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'people', doc_count: 2 },
                { key: 'organisation', doc_count: 1 }
              ]
            }
          }
        },
        all: {
          category: {
            category_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Aeronautics', doc_count: 2 },
                { key: 'Art', doc_count: 1 }
              ]
            }
          },
          maker: {
            maker_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Ada', doc_count: 2 },
                { key: 'Simon', doc_count: 1 }
              ]
            }
          },
          type: {
            type_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Medal', doc_count: 2 },
                { key: 'Bottle', doc_count: 1 }
              ]
            }
          },
          place: {
            place_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'London', doc_count: 2 },
                { key: 'Paris', doc_count: 1 }
              ]
            }
          },
          user: {
            user_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Ada', doc_count: 2 },
                { key: 'Simon', doc_count: 1 }
              ]
            }
          }
        },
        objects: {
          category: {
            category_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Aeronautics', doc_count: 2 },
                { key: 'Art', doc_count: 1 }
              ]
            }
          },
          maker: {
            maker_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Ada', doc_count: 2 },
                { key: 'Simon', doc_count: 1 }
              ]
            }
          },
          type: {
            type_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Medal', doc_count: 2 },
                { key: 'Bottle', doc_count: 1 }
              ]
            }
          },
          place: {
            place_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'London', doc_count: 2 },
                { key: 'Paris', doc_count: 1 }
              ]
            }
          },
          user: {
            user_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'Ada', doc_count: 2 },
                { key: 'Simon', doc_count: 1 }
              ]
            }
          }
        },
        documents: {
          archive: {
            archive_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                { key: 'The Babbage Papers', doc_count: 2 }
              ]
            }
          },
          organisation: {
            organisation_filters: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: []
            }
          }
        }
      }
    });
  },

  get: function () {
    const cb = arguments[arguments.length - 1];

    cb(null, {
      _index: '',
      _type: '',
      _id: '',
      _version: 1,
      found: true,
      _source: {}
    });
  }
});

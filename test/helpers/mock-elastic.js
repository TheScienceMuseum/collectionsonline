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

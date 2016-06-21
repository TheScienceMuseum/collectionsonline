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

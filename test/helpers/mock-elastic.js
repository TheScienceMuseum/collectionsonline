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
  }
});

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/categories',
  config: {
    handler: function (request, reply) {
      elastic.search({
        index: 'smg',
        type: 'object',
        body: {
          size: 0,
          aggs: {
            categories: {
              terms: {
                field: 'categories.name',
                size: 500,
                order: { '_count': 'desc' }
              }
            }
          }
        }
      }, (err, result) => {
        if (err) {
          return reply(err);
        }
        var categories = [];
        if (result.aggregations.categories.buckets) {
          result.aggregations.categories.buckets.forEach(e => {
            categories.push({
              displayname: e.key,
              link: '/search/categories/' + e.key.toLowerCase().split(' ').join('-'),
              count: e.doc_count
            });
          });
        }
        console.log(categories);
        return reply.view('categories', {categories: categories});
      });
    }
  }
});

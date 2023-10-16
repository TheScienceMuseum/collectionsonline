const Boom = require('boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/categories',
  config: {
    handler: async function (request, h) {
      try {
        const result = await elastic.search({
          index: 'ciim',
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
        });

        let categories = [];

        if (result.aggregations.categories.buckets) {
          result.aggregations.categories.buckets.forEach(e => {
            categories.push({
              displayname: e.key,
              link: '/search/categories/' + e.key.toLowerCase().split(' ').join('-'),
              count: e.doc_count
            });
          });
        }

        return h.view('categories', { categories: categories });
      } catch (err) {
        return new Boom(err);
      }
    }
  }
});

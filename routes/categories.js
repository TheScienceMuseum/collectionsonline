const Boom = require('@hapi/boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/categories',
  config: {
    handler: async function (request, h) {
      try {
        const result = await elastic.search({
          index: 'ciim',
          body: {
            size: 0,
            aggs: {
              categories: {
                terms: {
                  field: 'category.name.keyword',
                  size: 500,
                  order: { _count: 'desc' }
                }
              }
            }
          }
        });

        const categories = [];
        if (result.body.aggregations.categories.buckets) {
          result.body.aggregations.categories.buckets.forEach((e) => {
            categories.push({
              displayname: e.key,
              link:
                '/search/categories/' +
                e.key.toLowerCase().split(' ').join('-'),
              count: e.doc_count
            });
          });
        }
        return h.view('categories', { categories });
      } catch (err) {
        return new Boom.Boom(err);
      }
    }
  }
});

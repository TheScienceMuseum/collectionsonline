const Boom = require('@hapi/boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/collections',
  config: {
    handler: async function (request, h) {
      try {
        const result = await elastic.search({
          index: 'ciim',
          type: 'object',
          body: {
            size: 0,
            aggs: {
              collections: {
                terms: {
                  field: 'lifecycle.collection.collector.summary_title',
                  size: 500,
                  order: { _count: 'desc' }
                }
              }
            }
          }
        });

        const collections = [];

        if (result.aggregations.collections.buckets) {
          result.aggregations.collections.buckets.forEach(e => {
            collections.push({
              displayname: e.key,
              link: '/search/collection/' + e.key.toLowerCase().split(' ').join('-'),
              count: e.doc_count
            });
          });
        }

        return h.view('collections', { collections });
      } catch (err) {
        return new Boom.Boom(err);
      }
    }
  }
});

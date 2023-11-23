const Boom = require('boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/neverbeenseen',
  config: {
    handler: async function (request, h) {
      try {
        const result = await elastic.search({
          index: 'ciim',
          type: 'object',
          body: {
            size: 1,
            query: {
              function_score: {
                query: {
                  bool:
                  {
                    must: [
                      { term: { '@datatype.base': 'object' } },
                      { exists: { field: 'multimedia' } }
                    ],
                    must_not: [{ exists: { field: 'admin.analytics.count.current' } }]
                  }
                },
                functions: [{
                  random_score: {
                    seed: Date.now()
                  }
                }]
              }
            },
            min_score: 0.01
          }
        });
        return h.response(
          result.body.hits.hits[0]
        );
      } catch (err) {
        return new Boom(err);
      }
    }
  }
});

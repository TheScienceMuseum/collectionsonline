const Boom = require('@hapi/boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/neverbeenseen',
  config: {
    handler: async function (request, h) {
      try {
        const result = await elastic.search({
          index: 'ciim',
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
                    must_not: [
                      { exists: { field: 'enhancement.analytics.current.cumulative_views' } },
                      { term: { 'grouping.@link.type': 'SPH' } }
                    ]
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
        // console.log(result.body.hits);
        return h.response(
          result.body.hits.hits[0]
        );
      } catch (err) {
        return new Boom.Boom(err);
      }
    }
  }
});

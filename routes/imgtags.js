const getImgTags = require('../lib/getImgTags');
const Boom = require('@hapi/boom');
const contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/imgtags',
  config: {
    cache: cacheHeaders(config, 3600),
    handler: async function (request, h) {
      const responseType = contentType(request);

      if (responseType === 'notAcceptable') {
        return h.response('Not Acceptable').code(406);
      }

      try {
        const result = await getImgTags(elastic);

        const imgTags = result.body.aggregations.img_tags_aggs.imgtags.buckets;
        const imgTagsParents = result.body.aggregations.img_tags_aggs.imgtagsParents.buckets;
        const imgTagSet = new Set();
        imgTags.concat(imgTagsParents).forEach(t => {
          imgTagSet.add(t.key.toLowerCase());
        });
        const tags = Array.from(imgTagSet).sort();

        if (responseType === 'html') {
          return h.view('imgtags', { tags });
        } else if (responseType === 'json') {
          return h.response(tags)
            .header('content-type', 'application/vnd.api+json');
        }
      } catch (err) {
        Boom.serverUnavailable(err);
      }
    }
  }
});

const getImgTags = require('../lib/getImgTags');
const Boom = require('boom');
const contentType = require('./route-helpers/content-type.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/imgtags',
  config: {
    handler: async function (request, h) {
      var responseType = contentType(request);

      if (responseType === 'notAcceptable') {
        return h.response('Not Acceptable').code(406);
      }

      try {
        const result = await getImgTags(elastic);

        const imgTags = result.aggregations.img_tags_aggs.imgtags.buckets;
        const imgTagsParents = result.aggregations.img_tags_aggs.imgtagsParents.buckets;
        var imgTagSet = new Set();
        imgTags.concat(imgTagsParents).forEach(t => {
          imgTagSet.add(t.key.toLowerCase());
        });
        const tags = Array.from(imgTagSet).sort();

        if (responseType === 'html') {
          return h.view('imgtags', {tags: tags});
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

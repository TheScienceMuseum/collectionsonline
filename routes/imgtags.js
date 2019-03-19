const getImgTags = require('../lib/getImgTags');
const Boom = require('boom');
const contentType = require('./route-helpers/content-type.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/imgtags',
  config: {
    handler: function (req, reply) {
      var responseType = contentType(req);

      if (responseType === 'notAcceptable') {
        return reply('Not Acceptable').code(406);
      }

      getImgTags(elastic, (err, result) => {
        if (err) return reply(Boom.serverUnavailable(err));
        const imgTags = result.aggregations.img_tags_aggs.imgtags.buckets;
        const imgTagsParents = result.aggregations.img_tags_aggs.imgtagsParents.buckets;
        var imgTagSet = new Set();
        imgTags.concat(imgTagsParents).forEach(t => {
          imgTagSet.add(t.key.toLowerCase());
        });
        const tags = Array.from(imgTagSet).sort();

        if (responseType === 'html') {
          return reply.view('imgtags', {tags: tags});
        } else if (responseType === 'json') {
          return reply(tags)
          .header('content-type', 'application/vnd.api+json');
        }
      });
    }
  }
});

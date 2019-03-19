const getImgTags = require('../lib/getImgTags');
const Boom = require('boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/imgtags',
  config: {
    handler: function (req, reply) {
      // get all the image tags
      getImgTags(elastic, (err, result) => {
        if (err) return reply(Boom.serverUnavailable(err));
        const imgTags = result.aggregations.img_tags_aggs.imgtags.buckets;
        const imgTagsParents = result.aggregations.img_tags_aggs.imgtagsParents.buckets;
        var imgTagSet = new Set();
        imgTags.concat(imgTagsParents).forEach( t => {
          imgTagSet.add(t.key.toLowerCase());
        })
        const tags = Array.from(imgTagSet).sort();

        return reply.view('imgtags', {tags: tags});
      });
    }
  }
});

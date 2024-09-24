const slug = require('slugg');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/barcode/{uid?}',
  config: {
    handler: async function (request, h) {
      if (request.params.uid && request.params.uid.match(/^[A-Za-z0-9]*$/)) {
        const barcode = encodeURIComponent(request.params.uid);
        const body = {
          query: {
            bool: {
              must: [{ match: { 'barcode.value': barcode } }]
            }
          }
        };
        try {
          const result = await elastic.search({ index: 'ciim', body });
          if (result.body.hits.hits) {
            const obj = result.body.hits.hits[0];
            let slugValue =
              obj._source.summary_title &&
              slug(obj._source.summary_title).toLowerCase();
            const title = obj._source?.summary?.title;
            const image =
              config.mediaPath +
              obj._source?.multimedia?.[0]?.['@processed']?.medium?.location;
            const uid = obj?._id;
            slugValue = slugValue ? '/' + slugValue : '';
            const path = '/objects/' + obj._id + slugValue;
            const description = obj._source?.description?.[0]?.value;
            return h.response({ path, title, image, uid, description });
          } else {
            return 'Barcode not found';
          }
        } catch (err) {
          return 'Error: ' + err;
        }
      } else {
        return h.view('barcode', {}, { layout: 'default' });
      }
    }
  }
});

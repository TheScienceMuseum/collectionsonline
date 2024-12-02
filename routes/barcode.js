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
          if (result.body.hits.hits && result.body.hits.hits.length) {
            const obj = result.body.hits.hits[0];
            if (!obj) {
              return h.redirect(config.rootUrl + '/barcode').permanent();
            }
            let slugValue =
              obj?._source?.summary_title &&
              slug(obj?._source?.summary_title).toLowerCase();
            const title = obj?._source?.summary?.title;
            const image =
              config.mediaPath +
              obj?._source?.multimedia?.[0]?.['@processed']?.medium?.location;
            const uid = obj?._id;
            slugValue = slugValue ? '/' + slugValue : '';
            const path = '/objects/' + obj?._id + slugValue;
            const description = obj?._source?.description?.[0]?.value;
            const barcodeId = obj?._source?.barcode?.value;
            return h.response({
              path,
              title,
              image,
              uid,
              description,
              barcodeId
            });
          } else {
            return h
              .response({
                error:
                  'Either an invalid barcode was used, or that item has not yet been added to the database'
              })
              .code(404)
              .type('application/json');
          }
        } catch (err) {
          return 'Error: ' + err;
        }
      } else {
        return h.view('barcode', {}, { layout: 'basic' });
      }
    }
  }
});

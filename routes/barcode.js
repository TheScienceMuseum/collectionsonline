const slug = require('slugg');
const Boom = require('@hapi/boom');

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
          const result = await elastic.search({ index: config.elasticIndex, body }, { requestTimeout: 5000 });

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

            const description = obj?._source?.description?.[0]?.value;

            const barcodeId = obj?._source?.barcode?.value;

            // Many barcoded records are *parts* of a larger object (e.g. an
            // engine bay scanned individually as a child record of the car).
            // Parts don't have their own public catalogue pages — visiting
            // /objects/{partId} redirects to the parent. We surface this in
            // the API so the client can:
            //   1. show a "Part of …" line in the scan preview
            //   2. link directly to the parent path, avoiding the redirect
            const parentEntry = obj?._source?.parent?.[0];
            const parentUid = parentEntry?.['@admin']?.uid;
            const parentTitle = parentEntry?.summary?.title;
            const isPart = !!parentUid;

            // Default: the scanned record's own path. If it's a part, point
            // the client at the parent path instead — that's where the user
            // will end up anyway after the redirect.
            let path;
            if (isPart) {
              const parentSlug = parentTitle ? '/' + slug(parentTitle).toLowerCase() : '';
              path = '/objects/' + parentUid + parentSlug;
            } else {
              path = '/objects/' + obj?._id + slugValue;
            }

            return h.response({
              path,
              title,
              image,
              uid,
              description,
              barcodeId,
              isPart,
              parentTitle: isPart ? parentTitle : null,
              parentUid: isPart ? parentUid : null
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
          return Boom.serverUnavailable();
        }
      } else {
        return h.view('barcode', {}, { layout: 'basic' });
      }
    }
  }
});

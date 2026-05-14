const slug = require('slugg');
const Boom = require('@hapi/boom');
const sortImages = require('../lib/helpers/jsonapi-response/sort-images');

// Pick the first usable derivative for a preview thumbnail. Falls back through
// sizes because some records' first image has only a subset of derivatives.
// Returns null if nothing usable was found.
function firstImageLocation (source) {
  const raw = Array.isArray(source?.multimedia)
    ? source.multimedia.filter(m => m && m['@processed'])
    : [];
  if (!raw.length) return null;
  const sorted = sortImages(raw);
  const p = sorted[0]?.['@processed'];
  return (
    p?.medium?.location ||
    p?.large_thumbnail?.location ||
    p?.large?.location ||
    p?.small_thumbnail?.location ||
    null
  );
}

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

            // Match the sort order the object page uses (lib/jsonapi-response.js
            // → sortImages: position asc, upload_sort desc) so the preview
            // thumbnail aligns with what the user sees on /objects/{id}.
            let imageLocation = firstImageLocation(obj?._source);

            const uid = obj?._id;
            slugValue = slugValue ? '/' + slugValue : '';

            const description = obj?._source?.description?.[0]?.value;

            const barcodeId = obj?._source?.barcode?.value;

            // Object accession number — what staff in the stores will
            // recognise on the labels (e.g. "1935-502 Pt1"). Identifier
            // records are tagged with type/primary; prefer the primary
            // accession number, fall back to the first identifier value.
            const identifiers = obj?._source?.identifier;
            const primaryAcc = Array.isArray(identifiers) &&
              identifiers.find(function (i) {
                return i && i.primary && i.type === 'accession number';
              });
            const objectId = (primaryAcc && primaryAcc.value) ||
              (Array.isArray(identifiers) && identifiers[0] && identifiers[0].value) ||
              null;

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

            // Parts often have no multimedia of their own (e.g. SMG00420385,
            // a lens cap). Since the sheet's "View record" links to the parent
            // anyway, fall back to the parent's first sorted image so the
            // preview matches what the user will see after clicking through.
            if (!imageLocation && isPart && parentUid) {
              try {
                const parentRes = await elastic.get(
                  { index: config.elasticIndex, id: parentUid },
                  { requestTimeout: 5000 }
                );
                imageLocation = firstImageLocation(parentRes?.body?._source);
              } catch (e) {
                // Swallow — a missing/unreachable parent shouldn't break the
                // primary scan response. The UI handles a null image.
              }
            }

            const image = imageLocation ? config.mediaPath + imageLocation : null;

            return h.response({
              path,
              title,
              image,
              uid,
              description,
              barcodeId,
              objectId,
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

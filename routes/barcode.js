const slug = require('slugg');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/barcode/{uid?}',
  config: {
    handler: async function (request, h) {
      if (request.params.uid && request.params.uid.match(/^[A-Za-z0-9]*$/)) {
        const barcode = escape(request.params.uid);
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
            let slugValue = obj._source.summary_title && slug(obj._source.summary_title).toLowerCase();
            slugValue = slugValue ? ('/' + slugValue) : '';
            const path = '/objects/' + obj._id + slugValue;
            return h.redirect(config.rootUrl + path).permanent();
          } else {
            return 'Barcode not found';
          }
        } catch (err) {
          return 'Error: ' + err;
        }
      } else {
        return h.view('barcode', null, { layout: 'basic' });
      }
    }
  }
});

// const slug = require('slugg');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/barcode/{uid?}',
  config: {
    handler: async function (request, h) {
      if (request.params.uid) {
        const barcode = escape(request.params.uid);
        var body = {
          query: {
            "bool": {
                "must": [{
                    "match": {
                        "barcode.value": barcode
                    }
                }]
            }
          }
        };
        try {
          const result = await elastic.search({ index: 'ciim', body: body });
          if (result.body.hits.hits) {
            var obj = result.body.hits.hits[0];
            var slugValue = obj._source.summary_title && slug(obj._source.summary_title).toLowerCase();
            slugValue = slugValue ? ('/' + slugValue) : '';
            path = '/objects/' + obj._id + slugValue;
            return h.redirect(config.rootUrl + path).permanent();
          } else {
            return "Barcode not found";
          }
        } catch (err) {
          return 'Error: ' + err;
        }
      } else {
        return h.view('barcode');
      }
    }
  }
});

// const slug = require('slugg');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/barcode/{uid?}',
  config: {
    handler: async function (request, h) {
      if (request.params.uid) {
        const barcode = escape(request.params.uid);
        return `Barcode found: <b>${barcode}</b><br>Barcode not found in index<br><a href="/barcode">Scan again</a>`;
        // var body = {
        //   query: {
        //     bool: { filter: { term: { 'identifier.value': barcode } } }
        //   }
        // };
        // try {
        //   const result = await elastic.search({ index: 'ciim', body: body });
        //   if (result.hits.total>0) {
        //     var obj = result.hits.hits[0];
        //     var slugValue = obj._source.summary_title && slug(obj._source.summary_title).toLowerCase();
        //     slugValue = slugValue ? ('/' + slugValue) : '';
        //     path = '/objects/' + obj._id + slugValue;
        //     return h.redirect(config.rootUrl + path).permanent();
        //   } else {
        //     return "Barcode not found";
        //   }
        // } catch (err) {
        //   return 'Error: ' + err;
        // }
      } else {
        return h.view('barcode');
      }
    }
  }
});

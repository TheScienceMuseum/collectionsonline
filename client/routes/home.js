var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var QueryString = require('querystring');
var searchBox = require('../lib/search-box');
var createQueryParams = require('../../lib/query-params.js');
var getData = require('../lib/get-data.js');

module.exports = function (page) {
  page('/', function (ctx) {
    // Temporary until templates pulled into js for client side rendering
    if (!ctx.isInitialRender) {
      window.location = ctx.path;
    }

    var searchBoxEl = document.getElementById('searchbox');

    searchBoxEl.addEventListener('submit', function (e) {
      e.preventDefault();

      var qs = { q: $('.tt-input', this).val() };
      var url = '/search?' + QueryString.stringify(qs);
      var queryParams = createQueryParams('json', {query: qs, params: {}});
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };

      getData(url, opts, queryParams, function (data) {
        ctx.state.data = data;
        page.show(url, ctx.state);
      });
    });

    svg4everybody();
    searchBox();
  });
};

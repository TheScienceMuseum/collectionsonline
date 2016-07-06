var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var fetch = require('fetch-ponyfill')();
var QueryString = require('querystring');
var searchBox = require('../lib/search-box');
var searchResultsToTemplateData = require('../../lib/transforms/search-results-to-template-data');
var createQueryParams = require('../../lib/query-params.js');

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

      fetch(url, opts)
      .then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          return Promise.reject(new Error(res.status + ' Failed to fetch results'));
        }
      })
      .then(function (json) {
        if (json.errors) return Promise.reject(json.errors[0]);
        var data = searchResultsToTemplateData(queryParams, json);
        ctx.state.data = data;
        page.show(url, ctx.state);
      })
      .catch(function (err) {
        console.error('Failed to search', err);
      });
    });

    svg4everybody();
    searchBox();
  });
};

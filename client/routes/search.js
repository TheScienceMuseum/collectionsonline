var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var QueryString = require('querystring');
var Templates = require('../templates');
var searchBox = require('../lib/search-box');
var createQueryParams = require('../../lib/query-params.js');
var getData = require('../lib/get-data.js');
var convertUrl = require('../lib/convert-url.js');
var getQueryString = require('../lib/get-qs.js');

module.exports = function (page) {
  page('/search', load, render, listeners);
  page('/search/:type', load, render, listeners);

  function load (ctx, next) {
    if (!ctx.state.data) {
      var url = ctx.path;
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };
      var qs = QueryString.parse(ctx.querystring);
      Object.keys(qs).forEach(el => {
        if (Array.isArray(qs[el])) {
          qs[el] = qs[el].join();
        }
      });
      var queryParams = createQueryParams('json', {query: qs, params: {}});

      getData(convertUrl(url, 'json'), opts, queryParams, function (data) {
        ctx.state.data = data;
        next();
      });
    } else {
      next();
    }
  }

  function render (ctx, next) {
    if (ctx.params.type) {
      var filter = 'isFilter' + ctx.params.type[0].toUpperCase() + ctx.params.type.slice(1);
      if (filter !== 'All') ctx.state.data.isFilterAll = false;
      ctx.state.data[filter] = true;
    }
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementsByTagName('main')[0];
      pageEl.innerHTML = Templates['search'](ctx.state.data);

      // Shows filter toggle button if javascript enabled
      document.getElementById('fb').className = 'control__button';
      document.querySelector('button.filterpanel__button').style.display = 'none';

      // Hides filterpanel by default if javascript is enabled
      if (!Object.keys(ctx.state.data.selectedFilters).length) {
        $('.searchresults').removeClass('searchresults--filtersactive');
        $('.filtercolumn').removeClass('filtercolumn--filtersactive');
        $('.control--filters').removeClass('control--active');
      }
    }
    next();
  }

  function listeners (ctx, next) {
    var searchBoxEl = document.getElementById('searchbox');

    // New Search
    searchBoxEl.addEventListener('submit', function (e) {
      e.preventDefault();
      // TODO: Maybe a nice loading spinner?
      $('#searchresults .searchresults__column').animate({ opacity: 0.5 });

      var qs = {};
      qs.q = $('.tt-input', this).val();
      var params = ctx.params;
      var url = params[0] + '?' + QueryString.stringify(qs);
      var queryParams = createQueryParams('json', {query: qs, params: params});
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };

      getData(convertUrl(url, 'json'), opts, queryParams, function (data) {
        ctx.state.data = data;
        page.show(convertUrl(url, 'json'), ctx.state);
      });
    });

    // Show/hide filters
    $('.control__button').on('click', function (e) {
      $('.searchresults').toggleClass('searchresults--filtersactive');
      $('.filtercolumn').toggleClass('filtercolumn--filtersactive');
      $('.control--filters').toggleClass('control--active');
    });

    // Clear Filters
    $('.filter').on('click', '.filter__clear', function (e) {
      e.preventDefault();
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };
      var qs = {q: $('.tt-input').val()};
      var queryParams = createQueryParams('json', {query: qs, params: {}});
      var url = ctx.pathname + '?' + QueryString.stringify(qs);

      getData(url, opts, queryParams, function (data) {
        ctx.state.data = data;
        page.show(url, ctx.state);
      });
    });

    // Click to add/remove filters
    $('.filter:not(.filter--uncollapsible)').on('click', '[type=checkbox]', function (e) {
      var q = $('.tt-input').val();
      var qs = getQueryString(e, ctx, q);
      var params = ctx.params;
      var url = ctx.pathname + '?' + QueryString.stringify(qs);
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };
      var queryParams = createQueryParams('json', {query: qs, params: params}, ctx.state.data.selectedFilters);
      getData(url, opts, queryParams, function (data) {
        ctx.state.data = data;
        page.show(convertUrl(url, 'html'), ctx.state);
      });
    });

    svg4everybody();
    searchBox();
  }
};

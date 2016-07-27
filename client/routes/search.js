var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var QueryString = require('querystring');
var Templates = require('../templates');
var searchBox = require('../lib/search-box');
var createQueryParams = require('../../lib/query-params/query-params.js');
var getData = require('../lib/get-data.js');
var toJsonUrl = require('../lib/to-json-url');
var getQueryString = require('../lib/get-qs');
var filterState = require('../lib/filter-state');

module.exports = function (page) {
  page('/search', load, render, listeners);
  page('/search/:type', load, render, listeners);
  /**
  * Ajax request to get the data of the url
  * assign ctx.state with an object representing the data displayed on the page
  */
  function load (ctx, next) {
    // only load the data if the page hasn't been loaded before
    if (!ctx.isInitialRender) {
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };
      var qs = QueryString.parse(ctx.querystring);
      var queryParams = createQueryParams('html', {query: qs, params: {type: ctx.params.type}});
      getData(ctx.pathname + '?' + toJsonUrl(ctx.querystring), opts, queryParams, function (data) {
        ctx.state.data = data;
        next();
      });
    } else {
      ctx.state.data = {};
      // jump to the listeners function to add the event listeners to the dom
      listeners(ctx, next);
    }
  }

  /**
  * Call the Handlebars template with the data and display the new DOM on the page
  */
  function render (ctx, next) {
    var pageEl = document.getElementsByTagName('main')[0];
    pageEl.innerHTML = Templates['search'](ctx.state.data);

    // Shows filter toggle button if javascript enabled
    document.getElementById('fb').className = 'control__button';
    // document.querySelector('button.filterpanel__button').style.display = 'none';

    // Hides filterpanel by default if javascript is enabled
    if (!ctx.isFilterOpen) {
      $('.searchresults').removeClass('searchresults--filtersactive');
      $('.filtercolumn').removeClass('filtercolumn--filtersactive');
      $('.control--filters').removeClass('control--active');
    }

    // refresh the title of the page
    document.getElementsByTagName('title')[0].textContent = ctx.state.data.title;
    next();
  }

  /**
  * Define event listeners for search and filters
  */
  function listeners (ctx, next) {
    var searchBoxEl = document.getElementById('searchbox');

    // New Search
    searchBoxEl.addEventListener('submit', function (e) {
      e.preventDefault();
      // TODO: Maybe a nice loading spinner?
      $('#searchresults .searchresults__column').animate({ opacity: 0.5 });
      var qs = {};
      qs.q = $('.tt-input', this).val();
      var url = ctx.pathname + '?' + QueryString.stringify(qs);
      page.show(url);
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
      var qs = {q: $('.tt-input').val()};
      var url = ctx.pathname + '?' + QueryString.stringify(qs);
      page.show(url);
    });
    /**
    * Click to add/remove filters
    * Build a html url with the new filter selected (get the current url + new filter)
    */
    $('.filter:not(.filter--uncollapsible)').on('click', '[type=checkbox]', function (e) {
      var url = ctx.pathname + '?' + getQueryString();
      page.show(url);
    });

    /**
    * Search when the result per page is change
    */
    $('.control--rpp select').on('change', function (e) {
      var url = ctx.pathname + '?' + getQueryString();
      page.show(url);
    });

    $('#fb').on('click', function (e) {
      filterState.isFilterOpen = !filterState.isFilterOpen;
    });

    svg4everybody();
    searchBox();
  }
};

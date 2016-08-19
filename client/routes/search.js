var $ = require('jquery');
var QueryString = require('querystring');
var fetch = require('fetch-ponyfill')();
var initJqueryComp = require('../lib/init-jquery-components');
var Templates = require('../templates');
var createQueryParams = require('../../lib/query-params/query-params');
var getData = require('../lib/get-data.js');
var toJsonUrl = require('../lib/to-json-url');
var filterState = require('../lib/filter-state');
var filterResults = require('../lib/filter-results');
var page = require('page');
var searchResultsToTemplateData = require('../../lib/transforms/search-results-to-template-data');
var searchListener = require('../lib/search-listener');
var Snackbar = require('snackbarlightjs');

module.exports = function (page) {
  page('/search', load, render, listeners);
  page('/search/:type', load, render, listeners);
};
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
    getData(ctx.pathname + '?' + toJsonUrl(ctx.querystring), opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server');
        return;
      }
      var data = searchResultsToTemplateData(queryParams, json);
      ctx.state.data = data;
      next();
    });
  } else {
    ctx.state.data = {};
    listeners(ctx);
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
  document.querySelector('button.filterpanel__button').style.display = 'none';

  // Hides filterpanel by default if javascript is enabled
  if (!ctx.isFilterOpen) {
    $('.searchresults').removeClass('searchresults--filtersactive');
    $('.filtercolumn').removeClass('filtercolumn--filtersactive');
    $('.control--filters').removeClass('control--active');
  }

  // refresh the title of the page
  document.getElementsByTagName('title')[0].textContent = ctx.state.data.titlePage;
  next();
}

/**
* Define event listeners for search and filters
*/
function listeners (ctx, next) {
  searchListener();
  // Show/hide filters
  $('.control__button').on('click', function (e) {
    $('.searchresults').toggleClass('searchresults--filtersactive');
    $('.filtercolumn').toggleClass('filtercolumn--filtersactive');
    $('.control--filters').toggleClass('control--active');
  });

  // Clear Filters
  $('.filter').on('click', '.filter__clear', function (e) {
    e.preventDefault();
    var qs = {q: $('.searchbox__search').val()};
    var url = ctx.pathname + '?' + QueryString.stringify(qs);
    page.show(url);
  });
  /**
  * Click to add/remove filters
  * Build a html url with the new filter selected (get the current url + new filter)
  */
  $('.filter:not(.filter--uncollapsible)').on('click', '[type=checkbox]', function (e) {
    filterResults(ctx, page);
  });

  /**
  * Search when one of the input date onblur
  */
  $('.filter:not(.filter--uncollapsible)').on('blur', '[type=number]', function (e) {
    filterResults(ctx, page);
  });

  /**
  * Search when the result per page is change
  */
  $('.control--rpp select').on('change', function (e) {
    filterResults(ctx, page);
  });

  /**
  * update filter status (open/close)
  */
  $('#fb').on('click', function (e) {
    filterState.isFilterOpen = !filterState.isFilterOpen;
  });

  initJqueryComp();

  const onResultClick = (e) => {
    const id = e.currentTarget.getAttribute('href').split('/').pop();

    fetch('/analytics', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ event: 'RESULT_CLICK', data: id })
    }).catch((err) => console.error('Failed to send RESULT_CLICK analytics', err));
  };

  const resultLinks = document.querySelectorAll('#searchresults a');

  for (let i = 0; i < resultLinks.length; i++) {
    resultLinks[i].addEventListener('click', onResultClick);
  }
}

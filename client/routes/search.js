var QueryString = require('querystring');
var fetch = require('fetch-ponyfill')();
var initComp = require('../lib/init-components');
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
var toggleClass = require('../js-helpers/toggleClass');
var i = 0;

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
    var searchresults = document.querySelector('.searchresults');
    searchresults.className = searchresults.className.replace('searchresults--filtersactive', '');

    var filtercolumn = document.querySelector('.filtercolumn');
    filtercolumn.className = filtercolumn.className.replace('filtercolumn--filtersactive', '');

    var controlFilters = document.querySelector('.control--filters');
    controlFilters.className = controlFilters.className.replace('control--active', '');
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
  initComp();

  var toggleElements = function () {
    var searchresults = document.querySelector('.searchresults');
    searchresults.className = toggleClass(searchresults.className, 'searchresults--filtersactive');

    var filtercolumn = document.querySelector('.filtercolumn');
    filtercolumn.className = toggleClass(filtercolumn.className, 'filtercolumn--filtersactive');

    var controlFilters = document.querySelector('.control--filters');
    controlFilters.className = toggleClass(controlFilters.className, 'control--active');
  };

  var controlButtons = document.getElementsByClassName('control__button');
  for (i = 0; i < controlButtons.length; i++) {
    controlButtons[i].addEventListener('click', toggleElements);
  }

  /**
  * Click to add/remove filters
  * Build a html url with the new filter selected (get the current url + new filter)
  */
  var filtersCheckbox = document.querySelectorAll('.filter:not(.filter--uncollapsible) [type=checkbox]');
  for (i = 0; i < filtersCheckbox.length; i++) {
    filtersCheckbox[i].addEventListener('click', function () {
      filterResults(ctx, page);
    });
  }

  /**
  * Search when one of the input date onblur
  */
  var filtersDate = document.querySelectorAll('.filter:not(.filter--uncollapsible) [type=number]');
  for (i = 0; i < filtersDate.length; i++) {
    filtersDate[i].addEventListener('blur', function () {
      filterResults(ctx, page);
    });
  }

  /**
  * Search when the result per page is change
  */
  var controlRpp = document.querySelector('.control--rpp select');
  // the select page number only exists if there are enough results
  if (controlRpp) {
    controlRpp.addEventListener('change', function () {
      filterResults(ctx, page);
    });
  }

  /**
  * update filter status (open/close)
  */
  var filterButton = document.querySelector('#fb');
  filterButton.addEventListener('click', function () {
    filterState.isFilterOpen = !filterState.isFilterOpen;
  });

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

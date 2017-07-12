var QueryString = require('querystring');
var fetch = require('fetch-ponyfill')().fetch;
var page = require('page');
var Snackbar = require('snackbarlightjs');

var Templates = require('../templates');

var parseParams = require('../../routes/route-helpers/parse-params.js');

var createQueryParams = require('../../lib/query-params/query-params');
var paramify = require('../../lib/helpers/paramify.js');
var querify = require('../../lib/helpers/querify.js');
var searchResultsToTemplateData = require('../../lib/transforms/search-results-to-template-data');

var getData = require('../lib/get-data.js');
var filterResults = require('../lib/filter-results');
var filterState = require('../lib/filter-state.js');
var toggleFacets = require('../lib/toggle-facets.js');
var updateActiveStateFacets = require('../lib/update-active-states-facets.js');
var loadingBar = require('../lib/loading-bar');
var hideKeyboard = require('../lib/hide-keyboard');
var findCategory = require('../lib/find-category.js');

var displayFilters = require('../lib/listeners/display-filters.js');
var searchListener = require('../lib/listeners/search-listener');
var descriptionBoxCloseListener = require('../lib/listeners/close-description-box.js');
var deleteFiltersFacets = require('../lib/listeners/delete-filters-facets.js');
var displayFacet = require('../lib/listeners/display-facet.js');
var facetsStates = require('../lib/listeners/facets-states.js');
var initComp = require('../lib/listeners/init-components');

var i = 0;

module.exports = function (page) {
  page('/search', load, render, listeners);
  page('/search/*', load, render, listeners);
};
/**
* Ajax request to get the data of the url
* assign ctx.state with an object representing the data displayed on the page
*/
function load (ctx, next) {
  sessionStorage.setItem('backPath', ctx.path);
  // only load the data if the page hasn't been loaded before
  if (!ctx.isInitialRender) {
    loadingBar.start();
    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    var qs = QueryString.parse(ctx.querystring);
    var p = Object.assign(parseParams({filters: ctx.pathname}).categories, parseParams({filters: ctx.pathname}).params);
    var searchCategory = findCategory(ctx.pathname);
    var queryParams = createQueryParams('html', {query: Object.assign(qs, p), params: {type: searchCategory}});
    getData('/search' + (searchCategory ? '/' + searchCategory : '') + paramify(p) + querify(queryParams), opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server');
        return;
      }
      var data = searchResultsToTemplateData(queryParams, json);
      ctx.state.data = data;

      window.dataLayer.push(JSON.parse(data.layer));
      window.dataLayer.push({'event': 'serpEvent'});

      next();
    });
  } else {
    ctx.state.data = {};
    // change the display facet state to add active to the one who are
    listeners(ctx);
  }
}

/**
* Call the Handlebars template with the data and display the new DOM on the page
*/
function render (ctx, next) {
  window.scrollTo(0, 0);
  hideKeyboard();
  loadingBar.end();

  var searchResults = document.querySelector('.results-page');
  var searchBar = document.querySelector('.search-main');
  var pageEl = document.getElementsByTagName('main')[0];

  if (searchResults && searchBar) {
    // If already on the search page, just re-render the results
    searchBar.innerHTML = Templates['search-main'](ctx.state.data);
    searchResults.innerHTML = Templates['search-results'](ctx.state.data);
  } else {
    // Else re-render the whole page
    pageEl.innerHTML = Templates['search'](ctx.state.data);
  }

  // Shows filter toggle button if javascript enabled
  var fb = document.getElementById('fb');
  if (fb) {
    fb.className = 'control__button';
  }
  var filterButton = document.querySelector('button.filterpanel__button');
  if (filterButton) {
    filterButton.style.display = 'none';
  }

  // Hides filterpanel by default if javascript is enabled
  if (!ctx.isFilterOpen) {
    var searchresults = document.querySelector('.searchresults');
    searchresults.className = searchresults.className.replace('searchresults--filtersactive', '');

    var filtercolumn = document.querySelector('.filtercolumn');
    filtercolumn.className = filtercolumn.className.replace('filtercolumn--filtersactive', '');

    var controlFilters = document.querySelector('.control--filters');
    if (controlFilters) {
      controlFilters.className = controlFilters.className.replace('control--active', '');
    }
  }

  // refresh the title of the page
  document.getElementsByTagName('title')[0].textContent = ctx.state.data.titlePage;
  document.body.className = ctx.state.data.type;
  next();
}

/**
* Define event listeners for search and filters
*/
function listeners (ctx, next) {
  searchListener();
  descriptionBoxCloseListener();
  initComp();
  // hide the filter button
  var filterButton = document.querySelector('button.filterpanel__button');
  if (filterButton) {
    filterButton.style.display = 'none';
  }

  // display the button on the filter which toggle the filters
  var toggleFilterButton = document.getElementById('fb');
  if (toggleFilterButton) {
    toggleFilterButton.classList.remove('hidden');
    toggleFilterButton.classList.add('control__button');
  }

  // add click event listner on fb button to toggle the filter
  displayFilters(filterState.isFilterOpen);
  if (toggleFilterButton) {
    toggleFilterButton.addEventListener('click', function () {
      filterState.isFilterOpen = !filterState.isFilterOpen;
      displayFilters(filterState.isFilterOpen);
    });
  }

  updateActiveStateFacets(facetsStates, findCategory(ctx.pathname));
  // display the facet (close open or active)
  displayFacet(facetsStates, findCategory(ctx.pathname));

  // add event listener on the facet toggle
  toggleFacets(facetsStates, findCategory(ctx.pathname));

  // add event listener when the filters of a facet are cleared to update the state
  deleteFiltersFacets(facetsStates, findCategory(ctx.pathname));
  /**
  * Click to add/remove filters
  * Build a html url with the new filter selected (get the current url + new filter)
  */
  var filtersCheckbox = document.querySelectorAll('.filter:not(.filter--uncollapsible) [type=checkbox]');
  for (i = 0; i < filtersCheckbox.length; i++) {
    filtersCheckbox[i].addEventListener('click', function (e) {
      // analytics
      if (ctx.state.data.inProduction) {
        if (e.target.checked) {
          window.dataLayer.push({
            'event': 'Filter',
            'ga_event': {
              'category': 'filter',
              'action': ctx.params.type || 'all',
              'label': e.target.name + ' | ' + e.target.value,
              'value': e.target.value,
              'non-interaction': 'false'
            }
          });
        }
      }

      var museums = ['Science-Museum', 'National-Railway-Museum', 'National-Media-Museum', 'Museum-of-Science-and-Industry'];
      loadingBar.start();
      museums.forEach(function (m) {
        var museumFilter = document.getElementsByClassName('filter__museum__' + m)[0];
        var galleryFilters = document.querySelectorAll('.nested-galleries input[type=checkbox]');

        if (e.target.classList.contains('filter__gallery__' + m) && !museumFilter.checked) {
          museumFilter.checked = e.target.checked;
        } else if (e.target.classList.contains('filter__museum__' + m) && !museumFilter.checked) {
          Array.prototype.slice.call(galleryFilters).forEach(function (g) {
            g.checked = false;
          });
        }
      });
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
    filtersDate[i].addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        filterResults(ctx, page);
      }
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

  // analytics
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

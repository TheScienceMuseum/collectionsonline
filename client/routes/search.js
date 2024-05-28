const QueryString = require('querystring');
const fetch = require('fetch-ponyfill')().fetch;
const page = require('page');
const Snackbar = require('snackbarlightjs');

const Templates = require('../templates');

const parseParams = require('../../routes/route-helpers/parse-params.js');

const createQueryParams = require('../../lib/query-params/query-params');
const paramify = require('../../lib/helpers/paramify.js');
const querify = require('../../lib/helpers/querify.js');
const searchResultsToTemplateData = require('../../lib/transforms/search-results-to-template-data');

const getData = require('../lib/get-data.js');
const filterResults = require('../lib/filter-results');
const filterState = require('../lib/filter-state.js');
const toggleFacets = require('../lib/toggle-facets.js');
const updateActiveStateFacets = require('../lib/update-active-states-facets.js');
const loadingBar = require('../lib/loading-bar');
const hideKeyboard = require('../lib/hide-keyboard');
const findCategory = require('../lib/find-category.js');

const displayFilters = require('../lib/listeners/display-filters.js');
const searchListener = require('../lib/listeners/search-listener');
const descriptionBoxCloseListener = require('../lib/listeners/close-description-box.js');
const deleteFiltersFacets = require('../lib/listeners/delete-filters-facets.js');
const displayFacet = require('../lib/listeners/display-facet.js');
const facetsStates = require('../lib/listeners/facets-states.js');
const initComp = require('../lib/listeners/init-components');

const whatis = require('../../fixtures/whatis');

let i = 0;

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
    const opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    const qs = QueryString.parse(ctx.querystring);
    const p = Object.assign(
      parseParams({ filters: ctx.pathname }).categories,
      parseParams({ filters: ctx.pathname }).params
    );
    const searchCategory = findCategory(ctx.pathname);
    const queryParams = createQueryParams('html', {
      query: Object.assign(qs, p),
      params: { type: searchCategory }
    });
    // match and answer 'what is' questions
    if (qs.q && qs.q.toLowerCase().lastIndexOf('what', 0) === 0) {
      const answer = whatis.data.filter(function (a) {
        return a.attributes.summary_title.toLowerCase() === qs.q.toLowerCase();
      });

      if (answer.length > 0) {
        return page.redirect(answer[0].links.self);
      }
    }

    getData(
      '/search' +
        (searchCategory ? '/' + searchCategory : '') +
        paramify(p) +
        querify(queryParams),
      opts,
      function (err, json) {
        if (err) {
          console.error(err);
          Snackbar.create(
            'Error getting data from the server.\n<br>Please check your internet connection or try again shortly'
          );
          return;
        }
        const data = searchResultsToTemplateData(queryParams, json);
        ctx.state.data = data;

        window.dataLayer.push(JSON.parse(data.layer));
        window.dataLayer.push({ event: 'serpEvent' });

        next();
      }
    );
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

  const searchResults = document.querySelector('.results-page');
  const searchBar = document.querySelector('.search-main');
  const pageEl = document.getElementById('main-page');

  if (searchResults && searchBar) {
    // If already on the search page, just re-render the results
    searchBar.innerHTML = Templates['search-main'](ctx.state.data);
    searchResults.innerHTML = Templates['search-results'](ctx.state.data);
  } else {
    // Else re-render the whole page
    pageEl.innerHTML = Templates.search(ctx.state.data);
  }

  // Shows filter toggle button if javascript enabled
  const fb = document.getElementById('fb');
  if (fb) {
    fb.className = 'control__button';
  }
  const filterButton = document.querySelector('button.filterpanel__button');
  if (filterButton) {
    filterButton.style.display = 'none';
  }
  // Hides filterpanel by default if javascript is enabled
  if (!ctx.isFilterOpen) {
    const searchresults = document.querySelector('.searchresults');
    searchresults.className = searchresults.className.replace(
      'searchresults--filtersactive',
      ''
    );

    const filtercolumn = document.querySelector('.filtercolumn');
    filtercolumn.className = filtercolumn.className.replace(
      'filtercolumn--filtersactive',
      ''
    );

    const controlFilters = document.querySelector('.control--filters');
    if (controlFilters) {
      controlFilters.className = controlFilters.className.replace(
        'control--active',
        ''
      );
    }
  }

  // refresh the title of the page
  document.getElementsByTagName('title')[0].textContent =
    ctx.state.data.titlePage;
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
  const filterButton = document.querySelector('button.filterpanel__button');
  if (filterButton) {
    filterButton.style.display = 'none';
  }

  // display the button on the filter which toggle the filters
  const toggleFilterButton = document.getElementById('fb');
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
  const filtersCheckbox = document.querySelectorAll(
    '.filter:not(.filter--uncollapsible) [type=checkbox]'
  );
  for (i = 0; i < filtersCheckbox.length; i++) {
    filtersCheckbox[i].addEventListener('click', function (e) {
      // analytics
      if (ctx.state.data.inProduction) {
        if (e.target.checked) {
          window.dataLayer.push({
            event: 'Filter',
            ga_event: {
              category: 'filter',
              action: ctx.params.type || 'all',
              label: e.target.name + ' | ' + e.target.value,
              value: e.target.value,
              'non-interaction': 'false'
            }
          });
        }
      }

      const museums = [
        'Science-Museum',
        'National-Railway-Museum',
        'National-Media-Museum',
        'National-Science-and-Media-Museum',
        'Science-and-Industry-Museum',
        'Museum-of-Science-and-Industry'
      ];
      loadingBar.start();
      museums.forEach(function (m) {
        const museumFilter = document.getElementsByClassName(
          'filter__museum__' + m
        )[0];
        const galleryFilters = document.querySelectorAll(
          '.nested-galleries input[type=checkbox]'
        );

        if (
          e.target.classList.contains('filter__gallery__' + m) &&
          !museumFilter.checked
        ) {
          museumFilter.checked = e.target.checked;
        } else if (
          e.target.classList.contains('filter__museum__' + m) &&
          !museumFilter.checked
        ) {
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
  const filtersDate = document.querySelectorAll(
    '.filter:not(.filter--uncollapsible) [type=number]'
  );
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
  const controlRpp = document.querySelector('.control--rpp select');
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
    }).catch((err) =>
      console.error('Failed to send RESULT_CLICK analytics', err)
    );
  };

  const resultLinks = document.querySelectorAll('#searchresults a');

  for (let i = 0; i < resultLinks.length; i++) {
    resultLinks[i].addEventListener('click', onResultClick);
  }

  // close filters on mobile when no filter selected
  const onMobile =
    window.getComputedStyle(document.getElementById('filtercolumn'))
      .position === 'absolute';
  const noFilterSelected =
    [
      '/search',
      '/search/people',
      '/search/objects',
      '/search/documents',
      '/search/group'
    ].lastIndexOf(ctx.canonicalPath) !== -1;

  const qs = QueryString.parse(ctx.querystring).q;

  if ((onMobile && noFilterSelected) || (qs && onMobile)) {
    displayFilters(false);
    filterState.isFilterOpen = false;
  }
}

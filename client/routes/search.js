var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var fetch = require('fetch-ponyfill')();
var QueryString = require('querystring');
var Templates = require('../templates');
var searchBox = require('../lib/search-box');
var searchResultsToTemplateData = require('../../lib/transforms/search-results-to-template-data');
var createQueryParams = require('../../lib/query-params.js');

module.exports = function (page) {
  page('/search', getData, load, enter);
  page('/search/:type', getData, load, enter);

  function getData (ctx, next) {
    if (!ctx.state.data) {
      var url = ctx.path;
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };
      var qs = QueryString.parse(ctx.querystring);
      var queryParams = createQueryParams('json', {query: qs, params: {}});

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
          next();
        })
        .catch(function (err) {
          console.error('Failed to search', err);
        });
    } else {
      next();
    }
  }

  function load (ctx, next) {
    if (ctx.params.type) {
      var filter = 'isFilter' + ctx.params.type[0].toUpperCase() + ctx.params.type.slice(1);
      if (filter !== 'All') ctx.state.data.isFilterAll = false;
      ctx.state.data[filter] = true;
    }
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementsByTagName('main')[0];
      pageEl.innerHTML = Templates['search'](ctx.state.data);
    }
    next();
  }

  function enter (ctx, next) {
    var searchBoxEl = document.getElementById('searchbox');

    searchBoxEl.addEventListener('submit', function (e) {
      e.preventDefault();
      // TODO: Maybe a nice loading spinner?
      $('#searchresults .searchresults__column').animate({ opacity: 0.5 });

      var qs = { q: $('.tt-input', this).val() };
      var params = ctx.params;
      var url = params[0] + '?' + QueryString.stringify(qs);
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
          return;
        })
        .catch(function (err) {
          console.error('Failed to search', err);
        });
    });

    // fake filtering to show states
    $('.filter:not(.filter--uncollapsible)')
    .on('click', '.filter__name', function (e) {
      if ($(this).parent().hasClass('filter--open')) {
        $(this).parent().removeClass('filter--open');

        if ($(this).parent().hasClass('filter--active')) {
          $(this).parent().removeClass('filter--active');
          $(this).siblings().find('[type=checkbox]').prop('checked', false);
        }
      } else {
        $(this).parent().addClass('filter--open');
      }
    })
    .on('click', '[type=checkbox]', function (e) {
      // var filtername = $(this).closest('.filter').data('filter');
      if ($(this).closest('.filter__options').find(':checked').length > 0) {
        $(this).closest('.filter').addClass('filter--active');
        // $('.searchbox__filters [data-filter='+filtername+']').show();
      } else {
        $(this).closest('.filter').removeClass('filter--active');
        // $('.searchbox__filters [data-filter='+filtername+']').hide();
      }
    });

    svg4everybody();
    searchBox();
  }
};

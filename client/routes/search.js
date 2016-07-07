var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var QueryString = require('querystring');
var Templates = require('../templates');
var searchBox = require('../lib/search-box');
var createQueryParams = require('../../lib/query-params.js');
var getData = require('../lib/get-data.js');

module.exports = function (page) {
  page('/search', load, render, enter);
  page('/search/:type', load, render, enter);

  function load (ctx, next) {
    if (!ctx.state.data) {
      var url = ctx.path;
      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };
      var qs = QueryString.parse(ctx.querystring);
      var queryParams = createQueryParams('json', {query: qs, params: {}});

      getData(url, opts, queryParams, function (data) {
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

      // Hides filterpanel by default if javascript is enabled
      $('.searchresults').removeClass('searchresults--filtersactive');
      $('.filtercolumn').removeClass('filtercolumn--filtersactive');
      $('.control--filters').removeClass('control--active');
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

      getData(url, opts, queryParams, function (data) {
        ctx.state.data = data;
        page.show(url, ctx.state);
      });
    });

    $('.control__button').on('click', function (e) {
      $('.searchresults').toggleClass('searchresults--filtersactive');
      $('.filtercolumn').toggleClass('filtercolumn--filtersactive');
      $('.control--filters').toggleClass('control--active');
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

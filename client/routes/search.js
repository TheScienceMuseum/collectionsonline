var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var searchBox = require('../lib/search-box');

module.exports = function (page) {
  page('/search', enter);
  page('/search/:type', enter);

  function enter (ctx) {
    // Temporary until templates pulled into js for client side rendering
    if (!ctx.isInitialRender) {
      window.location = ctx.path;
    }

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

var filterState = require('../lib/filter-state');
module.exports = function (page) {
  page(function (ctx, next) {
    ctx.isFilterOpen = filterState.isFilterOpen;
    next();
  });
};

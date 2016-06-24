var svg4everybody = require('svg4everybody');
var searchBox = require('../lib/search-box');

module.exports = function (page) {
  page('/', function (ctx) {
    // Temporary until templates pulled into js for client side rendering
    if (!ctx.isInitialRender) {
      window.location = ctx.path;
    }

    svg4everybody();
    searchBox();
  });
};

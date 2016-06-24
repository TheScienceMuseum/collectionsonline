var svg4everybody = require('svg4everybody');
var searchBox = require('../lib/search-box');
var clipboard = require('../lib/clipboard');
var moreButton = require('../lib/more-button');
var openseadragon = require('../lib/openseadragon');
var slickCarousel = require('../lib/slick-carousel');

module.exports = function (page) {
  page('/documents/:id', enter);

  function enter (ctx) {
    // Temporary until templates pulled into js for client side rendering
    if (!ctx.isInitialRender) {
      window.location = ctx.path;
    }

    // TODO: AJAX fetch data for person

    svg4everybody();
    searchBox();
    clipboard();
    moreButton();
    openseadragon();
    slickCarousel();
  }
};

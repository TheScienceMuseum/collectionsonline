var svg4everybody = require('svg4everybody');
var searchBox = require('../lib/search-box');
var clipboard = require('../lib/clipboard');
var moreButton = require('../lib/more-button');
var slickCarousel = require('../lib/slick-carousel');

module.exports = (ctx) => {
  svg4everybody();
  searchBox();
  clipboard();
  moreButton();
  slickCarousel(ctx);
};

var svg4everybody = require('svg4everybody');
// var searchBox = require('../lib/search-box');
var clipboard = require('./clipboard');
var moreButton = require('./more-button');
var slickCarousel = require('./slick-carousel');

module.exports = (ctx) => {
  svg4everybody();
  // searchBox();
  clipboard();
  moreButton();
  slickCarousel(ctx);
};

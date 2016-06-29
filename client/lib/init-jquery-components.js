var svg4everybody = require('svg4everybody');
var searchBox = require('../lib/search-box');
var clipboard = require('../lib/clipboard');
var moreButton = require('../lib/more-button');
var openseadragon = require('../lib/openseadragon');
var slickCarousel = require('../lib/slick-carousel');

module.exports = () => {
  svg4everybody();
  searchBox();
  clipboard();
  moreButton();
  openseadragon();
  slickCarousel();
};

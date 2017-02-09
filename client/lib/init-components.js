var svg4everybody = require('svg4everybody');
var searchBox = require('../lib/search-box');
var clipboard = require('./clipboard');
var moreButton = require('./more-button');
var carousel = require('./carousel');
var moreDetails = require('./expand-details-button.js');

module.exports = (ctx) => {
  svg4everybody();
  searchBox();
  clipboard();
  moreButton();
  moreDetails();
  carousel(ctx);
};

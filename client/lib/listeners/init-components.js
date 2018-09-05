var svg4everybody = require('svg4everybody');
var searchBox = require('./search-box');
var clipboard = require('./clipboard');
var moreButton = require('./more-button');
var moreCordion = require('./accordion');
var carousel = require('./carousel');
var moreDetails = require('./expand-details-button');
var mediaplayer = require('./mediaplayer');
var headerMenu = require('./header-menu');
var illuminate = require('./illuminate');

module.exports = ctx => {
  svg4everybody();
  searchBox();
  clipboard();
  moreButton();
  moreCordion();
  moreDetails();
  carousel(ctx);
  mediaplayer();
  headerMenu();
  illuminate();
};

var svg4everybody = require('svg4everybody');
var searchBox = require('./search-box');
var clipboard = require('./clipboard');
var map = require('./map');
var moreButton = require('./more-button');
var moreCordion = require('./accordion');
var carousel = require('./carousel');
var moreDetails = require('./expand-details-button');
var mediaplayer = require('./mediaplayer');
var headerMenu = require('./header-menu');
var illuminate = require('./illuminate');
var osd = require('./osd');

module.exports = ctx => {
  svg4everybody();
  searchBox();
  clipboard();
  map();
  moreButton();
  moreCordion();
  moreDetails();
  carousel(ctx);
  mediaplayer();
  headerMenu();
  illuminate();
  osd(ctx);
};

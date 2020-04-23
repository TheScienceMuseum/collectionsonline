var svg4everybody = require('svg4everybody');
var searchBox = require('./search-box');
var clipboard = require('./clipboard');
var map = require('./map');
var moreButton = require('./more-button');
var moreCordion = require('smg-web-design-system/dist/js/accordion');
var carousel = require('./carousel');
var moreDetails = require('./expand-details-button');
var audioplayer = require('smg-web-design-system/dist/js/audioplayer');
var mediaplayer = require('./mediaplayer');
var headerMenu = require('smg-web-design-system/dist/js/menu');
var illuminate = require('smg-web-design-system/dist/js/illuminate');
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
  audioplayer();
  headerMenu();
  illuminate();
  osd(ctx);
};

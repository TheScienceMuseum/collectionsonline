const svg4everybody = require('svg4everybody');
const searchBox = require('./search-box');
const clipboard = require('./clipboard');
const map = require('./map');
const moreButton = require('./more-button');
const moreCordion = require('smg-web-design-system/dist/js/accordion');
const carousel = require('./carousel');
const moreDetails = require('./expand-details-button');
const audioplayer = require('smg-web-design-system/dist/js/audioplayer');
const mediaplayer = require('./mediaplayer');
const headerMenu = require('smg-web-design-system/dist/js/menu');
const illuminate = require('smg-web-design-system/dist/js/illuminate');
const osd = require('./osd');

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

const searchBox = require('./search-box');
const clipboard = require('./clipboard');
const map = require('./map');
const hashLinks = require('./hash-links');
const bannerSlides = require('./banner-slides');
const moreButton = require('./more-button');
const moreCordion = require('smg-web-design-system/dist/js/accordion');
const carousel = require('./carousel');
const audioplayer = require('smg-web-design-system/dist/js/audioplayer');
const mediaplayer = require('./mediaplayer');
const headerMenu = require('smg-web-design-system/dist/js/menu');
const illuminate = require('smg-web-design-system/dist/js/illuminate');
const osd = require('./osd');
const lightbox = require('./lightbox');

module.exports = (ctx) => {
  searchBox();
  clipboard();
  map();
  hashLinks();
  bannerSlides(ctx);
  moreButton();
  moreCordion();
  carousel(ctx);
  mediaplayer();
  audioplayer();
  headerMenu();
  illuminate();
  osd(ctx);
  lightbox();
};

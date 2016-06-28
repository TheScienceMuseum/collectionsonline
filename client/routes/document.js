var svg4everybody = require('svg4everybody');
var searchBox = require('../lib/search-box');
var clipboard = require('../lib/clipboard');
var fetch = require('fetch-ponyfill')();
var moreButton = require('../lib/more-button');
var openseadragon = require('../lib/openseadragon');
var slickCarousel = require('../lib/slick-carousel');
var Templates = require('../templates');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');

module.exports = function (page) {
  page('/documents/:id', enter);

  function enter (ctx) {
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementsByTagName('main')[0];

      var id = ctx.params.id;
      var url = '/documents/' + id;

      var opts = {
        headers: { Accept: 'application/vnd.api+json' }
      };

      fetch(url, opts)
      .then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          return Promise.reject(new Error(res.status + ' Failed to fetch results'));
        }
      })
      .then(function (json) {
        if (json.errors) return Promise.reject(json.errors[0]);
        pageEl.innerHTML = Templates['documents'](JSONToHTML(json));
        window.scrollTo(0, 0);
      })
      .then(function () {
        svg4everybody();
        searchBox();
        clipboard();
        moreButton();
        openseadragon();
        slickCarousel();
      })
      .catch(function (err) {
        console.error('Failed to find document', err);
      });
    } else {
      svg4everybody();
      searchBox();
      clipboard();
      moreButton();
      openseadragon();
      slickCarousel();
    }
  }
};

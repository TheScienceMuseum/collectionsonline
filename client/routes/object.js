var svg4everybody = require('svg4everybody');
var searchBox = require('../lib/search-box');
var clipboard = require('../lib/clipboard');
var fetch = require('fetch-ponyfill')();
var moreButton = require('../lib/more-button');
var openseadragon = require('../lib/openseadragon');
var slickCarousel = require('../lib/slick-carousel');
var Templates = require('../templates');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');
var exampleData = require('../../src/data/object.json');

module.exports = function (page) {
  page('/objects/:id', enter);

  function enter (ctx) {
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementsByTagName('main')[0];

      var id = ctx.params.id;
      var url = '/objects/' + id;

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
        var data = JSONToHTML(json);
        data.slides = exampleData.slides;
        pageEl.innerHTML = Templates['objects'](data);
        window.scrollTo(0, 0);
      })
      .then(function () {
        slickCarousel();
        svg4everybody();
        searchBox();
        clipboard();
        moreButton();
        openseadragon();
      })
      .catch(function (err) {
        console.error('Failed to find object', err);
      });
    } else {
      slickCarousel();
      svg4everybody();
      searchBox();
      clipboard();
      moreButton();
      openseadragon();
    }
  }
};

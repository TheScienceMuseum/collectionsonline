var svg4everybody = require('svg4everybody');
var $ = require('jquery');
var QueryString = require('querystring');
var searchBox = require('../lib/search-box');
var data = require('../../fixtures/data');
var Templates = require('../templates');

module.exports = function (page) {
  page('/', render, listeners);

  function render (ctx, next) {
    var pageEl = document.getElementsByTagName('main')[0];
    pageEl.innerHTML = Templates['home'](data);
    // refresh the title of the page
    document.getElementsByTagName('title')[0].textContent = data.titlePage;
    next();
  }

  function listeners (ctx, next) {
    var searchBoxEl = document.getElementById('searchbox');

    searchBoxEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var qs = { q: $('.tt-input', this).val() };
      var url = '/search?' + QueryString.stringify(qs);
      page.show(url);
    });

    svg4everybody();
    // autocomplete search
    searchBox();
  }
};

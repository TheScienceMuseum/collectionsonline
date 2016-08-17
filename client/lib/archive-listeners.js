var $ = require('jquery');
var QueryString = require('querystring');
var getData = require('./get-data.js');
var Templates = require('../templates');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');
var page = require('page');
var Snackbar = require('snackbarlightjs');

module.exports = (ctx, listeners) => {
  // Archive Browser Listener
  $('.expand').on('submit', function (e) {
    e.preventDefault();
    var archiveTree = document.getElementById('archive-tree');
    var documentID = this.id.slice(7);
    var query = QueryString.parse(ctx.querystring.substr(1));
    var url = ctx.pathname;

    if (query.expanded) {
      if (!Array.isArray(query.expanded)) {
        query.expanded = [query.expanded];
      }
      var queryPos = query.expanded.indexOf(documentID);
      if (queryPos > -1) {
        query.expanded.splice(queryPos, 1);
      } else {
        query.expanded.push(documentID);
      }
    } else {
      query.expanded = [];
      query.expanded.push(documentID);
    }

    ctx.querystring = '?' + QueryString.stringify(query);

    url += ctx.querystring;

    ctx.path = url;

    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };

    getData(url, opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server');
        return;
      }
      var data = JSONToHTML(json);
      archiveTree.innerHTML = Templates['archiveTree'](data);
      document.getElementsByTagName('title')[0].textContent = data.titlePage;
      listeners(ctx);
    });
  });

  // 'Search this Archive' Listener
  $('#archive-search').on('submit', function (e) {
    e.preventDefault();
    var q = encodeURIComponent(document.getElementById('archive-q').value);
    var archive = encodeURIComponent(document.getElementById('archive-title').value);
    var url = '/search/documents?q=' + q + '&archive=' + archive;
    page.show(url);
  });
};

var Templates = require('../templates');
var initJqueryComp = require('../lib/init-jquery-components.js');
var $ = require('jquery');
var QueryString = require('querystring');
var getDataItem = require('../lib/get-data-item');

module.exports = function (page) {
  page('/documents/:id', load, render, listeners);
};

function load (ctx, next) {
  if (!ctx.isInitialRender) {
    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    var id = ctx.params.id;
    var url = '/documents/' + id;
    getDataItem(url, opts, function (data) {
      ctx.state.data = data;
      next();
    });
  } else {
    ctx.state.data = {};
    initJqueryComp();
    listeners(ctx, next);
  }
}

function render (ctx, next) {
  var pageEl = document.getElementsByTagName('main')[0];
  pageEl.innerHTML = Templates['documents'](ctx.state.data);
  window.scrollTo(0, 0);
  initJqueryComp();
  next();
}

function listeners (ctx, next) {
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

    getDataItem(url, opts, function (data) {
      archiveTree.innerHTML = Templates['archiveTree'](data);
      document.getElementsByTagName('title')[0].textContent = data.titlePage;
      listeners(ctx, next);
    });
  });
}

var Templates = require('../templates');
var initComp = require('../lib/init-components.js');
var getData = require('../lib/get-data.js');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');
var searchListener = require('../lib/search-listener');
var archiveListeners = require('../lib/archive-listeners');
var Snackbar = require('snackbarlightjs');
var osdListener = require('../lib/osd-listener');
var downloadImageListener = require('../lib/download-image');

module.exports = function (page) {
  page('/documents/:id', load, render, listeners);
};

function load (ctx, next) {
  if (!ctx.isInitialRender) {
    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    var id = ctx.params.id;
    var url = '/documents/' + id + '?ajax=true';
    getData(url, opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server');
        return;
      }
      var data = JSONToHTML(json);
      ctx.state.data = data;
      next();
    });
  } else {
    ctx.state.data = {};
    listeners(ctx, next);
  }
}

function render (ctx, next) {
  var pageEl = document.getElementsByTagName('main')[0];
  pageEl.innerHTML = Templates['documents'](ctx.state.data);
  if (window.location.href.indexOf('#') === -1) {
    window.scrollTo(0, 0);
  }
  next();
}

function listeners (ctx, next) {
  initComp(ctx);
  searchListener();
  archiveListeners();
  osdListener(ctx);
  downloadImageListener();
}

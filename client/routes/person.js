var Templates = require('../templates');
var initComp = require('../lib/init-components.js');
var getData = require('../lib/get-data.js');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');
var searchListener = require('../lib/search-listener');
var Snackbar = require('snackbarlightjs');
var hideKeyboard = require('../lib/hide-keyboard');

module.exports = function (page) {
  page('/people/:id/:slug?', load, render, listeners);
};

function load (ctx, next) {
  if (!ctx.isInitialRender) {
    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    var id = ctx.params.id;
    var url = '/people/' + id + '?ajax=true';
    getData(url, opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server');
        return;
      }
      var data = JSONToHTML(json);
      ctx.state.data = data;
      if (data.inProduction) {
        console.log(data.inProduction);
        // analytics
        window.dataLayer.push(data.layer);
      }

      next();
    });
  } else {
    ctx.state.data = {};
    listeners(ctx, next);
  }
}

function render (ctx, next) {
  var pageEl = document.getElementsByTagName('main')[0];
  ctx.state.data.page = 'person';
  pageEl.innerHTML = Templates['people'](ctx.state.data);
  document.getElementsByTagName('title')[0].textContent = ctx.state.data.titlePage;
  hideKeyboard();
  window.scrollTo(0, 0);
  next();
}

function listeners (ctx, next) {
  initComp();
  searchListener();
}

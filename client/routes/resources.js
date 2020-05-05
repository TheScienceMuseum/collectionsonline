var Snackbar = require('snackbarlightjs');

var Templates = require('../templates');

var JSONToHTML = require('../../lib/transforms/json-to-html-data');

var getData = require('../lib/get-data.js');
var hideKeyboard = require('../lib/hide-keyboard');

var getArticles = require('../lib/listeners/get-articles');
var getWikiData = require('../lib/listeners/get-wiki-data');
var searchListener = require('../lib/listeners/search-listener');
var downloadImageListener = require('../lib/listeners/download-image');
var archiveListeners = require('../lib/listeners/archive-listeners');
var initComp = require('../lib/listeners/init-components.js');
var internalHeader = require('../lib/listeners/internal-header');

module.exports = function (type) {
  return {
    load: function (ctx, next) {
      load(ctx, next, type);
    },
    render: function (ctx, next) {
      render(ctx, next, type);
    },
    listeners: function (ctx, next) {
      listeners(ctx, next, type);
    }
  };
};

function load (ctx, next, type) {
  var pageType = type === 'people' ? type : type + 's';
  var page = type === 'people' ? 'person' : type;

  if (!ctx.isInitialRender) {
    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    var id = ctx.params.id;
    var url = '/' + pageType + '/' + id + '?ajax=true';

    getData(url, opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server.\n<br>Please check your internet connection or try again shortly');
        return;
      }
      var data = JSONToHTML(json);

      ctx.state.data = data;
      ctx.state.data.back = sessionStorage.getItem('backPath');
      // analytics
      window.dataLayer.push(JSON.parse(data.layer));
      window.dataLayer.push({ 'recordTitle': data.title });
      window.dataLayer.push({ 'event': 'recordEvent' });

      ctx.state.data.page = page;
      next();
    });
  } else {
    ctx.state.data = {};
    ctx.state.data.page = page;
    listeners(ctx, next, type);
  }
}

function render (ctx, next, type) {
  var pageType = type === 'people' ? type : type + 's';
  var pageEl = document.getElementsByTagName('main')[0];

  hideKeyboard();
  document.getElementsByTagName('title')[0].textContent = ctx.state.data.titlePage;
  document.body.className = ctx.state.data.type;
  pageEl.innerHTML = Templates[pageType](ctx.state.data);

  if (window.location.href.indexOf('#') === -1) {
    window.scrollTo(0, 0);
  }

  next();
}

function listeners (ctx, next, type) {
  var funcs = [initComp, searchListener ];

  if (type === 'object' || type === 'document') {
    funcs.push(downloadImageListener);
  }

  if (type === 'object') {
    funcs.push(getArticles);
  } else if (type === 'document') {
    funcs.push(archiveListeners, internalHeader);
  } else if (type === 'people') {
    funcs.push(getWikiData, internalHeader);
  }

  funcs.forEach(function (el) {
    el(ctx);
  });
}

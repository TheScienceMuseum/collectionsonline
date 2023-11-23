const Snackbar = require('snackbarlightjs');

const Templates = require('../templates');

const JSONToHTML = require('../../lib/transforms/json-to-html-data');

const getData = require('../lib/get-data.js');
const hideKeyboard = require('../lib/hide-keyboard');

// var getArticles = require('../lib/listeners/get-articles');
const getWikiData = require('../lib/listeners/get-wiki-data');
const searchListener = require('../lib/listeners/search-listener');
const downloadImageListener = require('../lib/listeners/download-image');
const archiveListeners = require('../lib/listeners/archive-listeners');
const initComp = require('../lib/listeners/init-components.js');
// var internalHeader = require('../lib/listeners/internal-header');

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
  const pageType = type === 'people' ? type : type + 's';
  const page = type === 'people' ? 'person' : type;

  if (!ctx.isInitialRender) {
    const opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    const id = ctx.params.id;
    const url = '/' + pageType + '/' + id + '?ajax=true';

    getData(url, opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server.\n<br>Please check your internet connection or try again shortly');
        return;
      }
      const data = JSONToHTML(json);

      ctx.state.data = data;
      ctx.state.data.back = sessionStorage.getItem('backPath');
      // analytics
      window.dataLayer.push(JSON.parse(data.layer));
      window.dataLayer.push({ recordTitle: data.title });
      window.dataLayer.push({ event: 'recordEvent' });

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
  const pageType = type === 'people' ? type : type + 's';
  const pageEl = document.getElementById('main-page');

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
  const funcs = [initComp, searchListener];

  if (type === 'object' || type === 'document') {
    funcs.push(downloadImageListener);
  }

  if (type === 'object') {
    // funcs.push(getArticles); # disabled while caching investigated
  } else if (type === 'document') {
    funcs.push(archiveListeners);
  } else if (type === 'people') {
    // funcs.push(getWikiData, internalHeader);
    funcs.push(getWikiData);
  }

  funcs.forEach(function (el) {
    el(ctx);
  });
}

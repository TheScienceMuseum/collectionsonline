var fetch = require('fetch-ponyfill')();
var Templates = require('../templates');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');
var initJqueryComp = require('../lib/init-jquery-components.js');
var $ = require('jquery');

module.exports = function (page) {
  page('/documents/:id', enter, listeners);

  function enter (ctx, next) {
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
        initJqueryComp();
        next();
      })
      .catch(function (err) {
        console.error('Failed to find document', err);
      });
    } else {
      initJqueryComp();
      next();
    }
  }

  function listeners (ctx) {
    $('.expand').on('submit', function (e) {
      e.preventDefault();
      var archiveTree = document.getElementById('archive-tree');
      var documentID = this.id.slice(7);

      var url = ctx.path;

      if (ctx.querystring) {
        url += '&expanded=' + documentID;
      } else {
        url += '?expanded=' + documentID;
      }

      ctx.path = url;

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
        archiveTree.innerHTML = Templates['archiveTree'](JSONToHTML(json));
        listeners(ctx);
      })
      .catch(function (err) {
        console.error('Failed to find document', err);
      });
    });
  }
};

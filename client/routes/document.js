var fetch = require('fetch-ponyfill')();
var Templates = require('../templates');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');
var initJqueryComp = require('../lib/init-jquery-components.js');
var $ = require('jquery');
var QueryString = require('querystring');

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
        archiveTree.innerHTML = Templates['archiveTree'](data);
        document.getElementsByTagName('title')[0].textContent = data.titlePage;
        listeners(ctx);
      })
      .catch(function (err) {
        console.error('Failed to find document', err);
      });
    });
  }
};

var fetch = require('fetch-ponyfill')();
var Templates = require('../templates');
var JSONToHTML = require('../../lib/transforms/json-to-html-data');
var initJqueryComp = require('../lib/init-jquery-components.js');

module.exports = function (page) {
  page('/people/:id', enter);

  function enter (ctx) {
    var pageEl = document.getElementsByTagName('main')[0];

    var id = ctx.params.id;
    var url = '/people/' + id;

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
      data.page = 'person';
      pageEl.innerHTML = Templates['people'](data);
      document.getElementsByTagName('title')[0].textContent = data.titlePage;
      window.scrollTo(0, 0);
    })
    .then(function () {
      initJqueryComp();
    })
    .catch(function (err) {
      console.error('Failed to find person', err);
    });
  }
};

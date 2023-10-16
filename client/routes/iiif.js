const Snackbar = require('snackbarlightjs');
const Templates = require('../templates');
const getData = require('../lib/get-data.js');

module.exports = function (page) {
  page('/iiif/:type/:id', load, render);

  function load (ctx, next) {
    const opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    const type = ctx.params.type;
    const id = ctx.params.id;
    const url = '/iiif/' + type + '/' + id;
    getData(url, opts, function (err, json) {
      if (err) {
        console.error(err);
        Snackbar.create('Error getting data from the server');
        return;
      }
      ctx.json = JSON.stringify(json, null, 2);
      next();
    });
  }

  function render (ctx, next) {
    const pageEl = document.getElementById('main-page');
    pageEl.innerHTML = Templates.api({ api: ctx.json });
  }
};

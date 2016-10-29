var getData = require('../lib/get-data.js');
var Snackbar = require('snackbarlightjs');

module.exports = function (page) {
  page('/api/:type/:id', load, render);

  function load (ctx, next) {
    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };
    var type = ctx.params.type;
    var id = ctx.params.id;
    var url = '/api/' + type + '/' + id + '?ajax=true';
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
    var body = document.getElementsByTagName('body')[0];
    console.log(body);
    body.textContent = ctx.json;
  }
};

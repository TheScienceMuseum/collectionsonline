var getData = require('./get-data');
var Templates = require('../templates');

module.exports = function (ctx) {
  var url = '/articles/' + ctx.params.id;
  var opts = {
    headers: { Accept: 'application/vnd.api+json' }
  };

  getData(url, opts, function (err, data) {
    if (err) {
      console.error(err);
    } else if (data.data.length >= 1) {
      var articles = document.getElementById('articles');
      articles.innerHTML = Templates['articles'](data);
    }
  });
};

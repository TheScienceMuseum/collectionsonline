const getData = require('../get-data');
const Templates = require('../../templates');

module.exports = function (ctx) {
  const url = '/articles/' + ctx.params.id;
  const opts = {
    headers: { Accept: 'application/vnd.api+json' }
  };

  getData(url, opts, function (err, data) {
    if (err) {
      console.error(err);
    } else if (data.data.length >= 1) {
      const articles = document.getElementById('articles');
      articles.innerHTML = Templates.articles(data);
    }
  });
};

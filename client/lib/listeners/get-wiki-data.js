const getData = require('../get-data');
const Templates = require('../../templates');

module.exports = function (ctx) {
  const wikiImage = document.getElementById('wikiImage');
  const wikiSummary = document.getElementById('wikiInfo');

  if (wikiImage) {
    const url = '/wiki/' + wikiImage.dataset.name;
    const opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };

    getData(url, opts, function (_err, data) {
      if (data && data.mainImage) {
        wikiImage.innerHTML = Templates.wikiImage(data);
        wikiSummary.innerHTML = Templates.wikiSummary(data);
      }
    });
  }
};

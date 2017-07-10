var getData = require('../get-data');
var Templates = require('../../templates');

module.exports = function (ctx) {
  var wikiImage = document.getElementById('wikiImage');
  if (wikiImage) {
    var url = '/wiki/' + wikiImage.dataset.name;
    var opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };

    getData(url, opts, function (err, data) {
      if (err) {
      } else if (data.mainImage) {
        wikiImage.innerHTML = Templates['wikiImage'](data);
      }
    });
  }
};

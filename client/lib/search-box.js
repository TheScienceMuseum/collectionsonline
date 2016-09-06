const Awesomplete = require('awesomplete');
const debounce = require('lodash.debounce');
const getData = require('./get-data');

module.exports = function () {
  let currentRequestId = null;
  var searchbox = document.querySelector('#searchbox [type=search]');
  var awesomplete = new Awesomplete(searchbox, {
    minChars: 3,
    autoFirst: false
  });
  searchbox.addEventListener('keyup', debounce(function (e) {
    var q = e.target.value;
    if (q.length > 0) {
      const requestId = currentRequestId = Date.now();
      const url = `/autocomplete?q=${encodeURIComponent(q)}`;
      const opts = { headers: { Accept: 'application/vnd.api+json' } };

      getData(url, opts, (err, results) => {
        if (err) {
          // No need to feedback - not mission critical
          return console.error('Failed to autocomplete', err);
        }

        if (requestId !== currentRequestId) {
          return console.warn('Ignoring autocomplete response', requestId, results);
        }
        const suggestions = results.data.map((r) => r.attributes.summary_title);
        awesomplete.list = suggestions;
      });
    }
  }, 500));
};

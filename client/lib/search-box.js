var $ = window.$ = window.jQuery = require('jquery');
require('typeahead.js');
const debounce = require('lodash.debounce');
const getData = require('./get-data');

module.exports = function () {
  let currentRequestId = null;

  $('#searchbox [type=search]').typeahead({
    minLength: 3,
    highlight: true
  }, {
    name: 'suggestions',
    source: debounce((q, onData, onAsyncData) => {
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
        onAsyncData(suggestions);
      });
    }, 500),
    async: true,
    limit: 10
  });
};

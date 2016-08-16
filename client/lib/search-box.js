var $ = window.$ = window.jQuery = require('jquery');
require('typeahead.js');
const getData = require('./get-data');

module.exports = function () {
  $('#searchbox [type=search]').typeahead({
    minLength: 1,
    highlight: true
  }, {
    name: 'suggestions',
    source: (q, onData, onAsyncData) => {
      const url = `/autocomplete?q=${encodeURIComponent(q)}`;
      const opts = { headers: { Accept: 'application/vnd.api+json' } };
      getData(url, opts, (results) => {
        const suggestions = results.data.map((r) => r.attributes.summary_title);
        onAsyncData(suggestions);
      });
    },
    async: true,
    limit: 10
  });

  $('#searchbox [type=search]').bind('typeahead:render', function (ev, sug, flag, name) {
    console.log('typeahead:render:' + sug);
  });

  $('#searchbox [type=search]').bind('typeahead:open', function () {
    console.log('typeahead:open');
  });

  $('#searchbox [type=search]').bind('typeahead:close', function () {
    console.log('typeahead:close');
  });

  $('#searchbox [type=search]').bind('typeahead:idle', function () {
    console.log('typeahead:idle');
  });

  $('#searchbox [type=search]').bind('typeahead:change', function () {
    console.log('typeahead:change');
  });
  // none of those events tell me when the suggestions box is visible!
};

var $ = window.$ = window.jQuery = require('jquery');
require('typeahead.js');
// fake static data to test.
var suggestions = require('../fixtures/typeahead.json');

module.exports = function () {
  // autocomplete. https://github.com/twitter/typeahead.js
  var substringMatcher = function (strs) {
    return function findMatches (q, cb) {
      var matches;

      // an array that will be populated with substring matches
      matches = [];

      // regex used to determine if a string contains the substring `q`
      var substrRegex = new RegExp(q, 'i');

      // iterate through the pool of strings and for any string that
      // contains the substring `q`, add it to the `matches` array
      $.each(strs, function (i, str) {
        if (substrRegex.test(str)) {
          matches.push(str);
        }
      });

      cb(matches);
    };
  };

  $('#searchbox [type=search]').typeahead({
    minLength: 1,
    highlight: true
  }, {
    name: 'suggestions',
    source: substringMatcher(suggestions)
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

  // fake function to act as temporary home button.
  // replace with a search engine or something;)
  $('.searchbox__submit').on('click', function () {
    window.location = '/index.html';
  });
};

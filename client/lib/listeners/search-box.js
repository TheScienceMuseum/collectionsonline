const Awesomplete = require('awesomplete');
const debounce = require('lodash/debounce');
const getData = require('../get-data');

module.exports = function () {
  let currentRequestId = null;
  const searchbox = document.getElementById('searchbox');
  const searchinput = document.querySelector('#searchbox [type=search]');
  if (!searchinput) return false;
  const awesomplete = new Awesomplete(searchinput, {
    minChars: 3,
    autoFirst: false,
    listLabel: 'Search results'
  });
  searchinput.addEventListener(
    'keyup',
    debounce(function (e) {
      const q = e.target.value;
      if (q.length > 0 && e.key !== 'Enter') {
        const requestId = (currentRequestId = Date.now());
        const url = `/autocomplete?q=${encodeURIComponent(q)}`;
        const opts = { headers: { Accept: 'application/vnd.api+json' } };

        getData(url, opts, (err, results) => {
          if (err) {
            // No need to feedback - not mission critical
            return console.error('Failed to autocomplete', err);
          }

          if (requestId !== currentRequestId) {
            return console.warn(
              'Ignoring autocomplete response',
              requestId,
              results
            );
          }
          const suggestions = results.data.map((r) => r.attributes.title);
          awesomplete.list = suggestions;
        });
      }
    }, 500)
  );
  searchinput.addEventListener('focus', function (e) {
    searchbox.classList.add('searchbox--focussed');
  });
  searchinput.addEventListener('blur', function (e) {
    searchbox.classList.remove('searchbox--focussed');
  });
  searchinput.addEventListener(
    'awesomplete-open',
    function (e) {
      searchbox.classList.add('searchbox--awesomplete-open');
    },
    false
  );
  searchinput.addEventListener(
    'awesomplete-close',
    function (e) {
      searchbox.classList.remove('searchbox--awesomplete-open');
    },
    false
  );

  if (document.location.pathname === '/') {
    const focused = document.activeElement;
    if (
      !focused ||
      focused === document.body ||
      focused === document.documentElement
    ) {
      searchinput.focus();
    }
  }
};

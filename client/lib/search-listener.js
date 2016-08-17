/**
* Add event listener to the searchbox
*/
var $ = require('jquery');
var QueryString = require('querystring');
var page = require('page');

module.exports = function () {
  var searchBoxEl = document.getElementById('searchbox');

  searchBoxEl.addEventListener('submit', function (e) {
    e.preventDefault();
    $('#searchresults .searchresults__column').animate({ opacity: 0.5 });
    const q = $('.searchbox__search.tt-input', this).val() || null;
    const qs = { q };
    var url = '/search?' + QueryString.stringify(qs);
    page.show(url);
  });
};

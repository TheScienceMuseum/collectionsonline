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
    var qs = {};
    qs.q = $('.searchbox__search', this).val();
    var url = '/search?' + QueryString.stringify(qs);
    page.show(url);
  });
};

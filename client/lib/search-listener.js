/**
* Add event listener to the searchbox
*/
var QueryString = require('querystring');
var page = require('page');

module.exports = function () {
  var searchBoxEl = document.getElementById('searchbox');
  searchBoxEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var searchValue = document.querySelector('.searchbox__search').value;
    const q = searchValue || null;
    const qs = { q };
    var url = '/search?' + QueryString.stringify(qs);
    page.show(url);
  });
};

const page = require('page');
const QueryString = require('querystring');

module.exports = () => {
  // 'Search this Archive' Listener
  const archiveSearch = document.querySelector('#archive-search');
  if (archiveSearch) {
    archiveSearch.addEventListener('submit', function (e) {
      e.preventDefault();
      const q = document.getElementById('archive-q').value;
      const qs = { q };
      const archive = document.getElementById('archive-title').value;
      const url = '/search/documents/archive/' + archive.toLowerCase().split(' ').join('-') + '?' + QueryString.stringify(qs);
      page.show(url);
    });
  }

  const archiveToggles = document.querySelectorAll('[aria-controls]');
  archiveToggles.forEach((toggle) => {
    toggle.addEventListener('click', function (e) {
      const target = document.getElementById(this.getAttribute('aria-controls'));
      const expand = target.hidden;
      this.setAttribute('aria-expanded', expand);
      const label = this.getAttribute('aria-label');
      this.setAttribute('aria-label', expand ? label.replace('Show', 'Hide') : label.replace('Hide', 'Show'));
      target.hidden = !expand;
    });
  });
};

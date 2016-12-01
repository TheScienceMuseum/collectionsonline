module.exports = function (page) {
  page.redirect('/scm', '/search?filter[museum]=Science Museum');
  page.redirect('/msi', '/search?filter[museum]=Museum of Science and Industry');
  page.redirect('/nmem', '/search?filter[museum]=National Media Museum');
  page.redirect('/nrm', '/search?filter[museum]=National Railway Museum');
};

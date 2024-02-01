module.exports = function (page) {
  page.redirect('/scm', '/search/museum/science-museum');
  page.redirect('/msi', '/search/museum/museum-of-science-and-industry');
  page.redirect('/nmem', '/search/museum/national-media-museum');
  page.redirect('/nsmm', '/search/museum/national-science-and-media-museum');
  page.redirect('/nrm', '/search/museum/national-railway-museum');
};

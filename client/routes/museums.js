module.exports = function (page) {
  page.redirect('/scm', '/search/museum/science-museum');
  page.redirect('/sim', '/search/museum/science-and-industry-museum');
  page.redirect('/nsmm', '/search/museum/national-science-media-museum');
  page.redirect('/nrm', '/search/museum/national-railway-museum');
};

// page.js currently listens to all clicks and responds as if page() router requests.
// This reinstates the default behavior on in-page anchor hash links.
// In theory you could override the page.clickHandler function, but this seemed simpler.
module.exports = () => {
  const hashLinks = document.querySelectorAll('a[href^="#"]');
  hashLinks.forEach((link) => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.getElementById(this.getAttribute('href').slice(1));
      target.tabIndex = -1;
      target?.focus();
      target.scrollIntoView();
    });
  });
};

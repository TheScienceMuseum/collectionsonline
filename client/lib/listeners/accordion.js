module.exports = function () {
  var accordions = document.querySelectorAll('.js-accordion-tab');
  if (accordions) {
    Array.prototype.slice.call(accordions).forEach(el => {
      el.addEventListener('click', function (e) {
        if (e.target) {
          var content = document.querySelector(
            '#' + e.target.getAttribute('aria-controls')
          );
          e.target.classList.toggle('-is-active');
          e.target.setAttribute(
            'aria-expanded',
            e.target.getAttribute('aria-expanded') !== 'true'
          );
          content.style.display = '';
          content.setAttribute(
            'aria-hidden',
            e.target.getAttribute('aria-hidden') !== 'true'
          );
        }
      });
    });
  }
};

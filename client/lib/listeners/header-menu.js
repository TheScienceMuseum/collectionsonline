/*
This is an adaptation of
https://github.com/argenteum/accessible-nav-wp
Which is used on the SMG blog sites (Wordpress)
Since we're not tied to WP html output, I have applied the extra a11y attributes directly to the html in
/templates/partials/global/global-header.html
but kept the same class names so css can be re-used without much change.
*/

module.exports = () => {
  var menuContainer = document.querySelector('.c-menu');
  var menuToggle = menuContainer.querySelector('.c-menu__button');
  var siteHeaderMenu = menuContainer.querySelector('.c-menu__wrapper');
  var siteNavigation = menuContainer.querySelector('.c-menu__nav');

  var screenReaderText = {
    expand: 'Expand child menu',
    collapse: 'Collapse child menu'
  };

  // Toggles the menu button
  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      this.classList.toggle('toggled-on');
      siteHeaderMenu.classList.toggle('toggled-on');

      this.setAttribute(
        'aria-expanded',
        this.getAttribute('aria-expanded') === 'false' ? 'true' : 'false'
      );
      siteNavigation.setAttribute(
        'aria-expanded',
        this.getAttribute('aria-expanded') === 'false' ? 'true' : 'false'
      );
    });
  }

  // If a dropdown has no top-level link (it's dummied to act as group, then skip it from tab order)
  siteNavigation.querySelectorAll('[href="#"]').forEach(function (el) {
    el.setAttribute('tabindex', -1);
    el.addEventListener('click', function (e) {
      e.preventDefault();
    });
  });

  // Toggles the sub-menu when dropdown toggle button clicked
  siteHeaderMenu.querySelectorAll('.dropdown-toggle').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var screenReaderSpan = this.querySelectorAll('.screen-readers');

      e.preventDefault();
      this.classList.toggle('toggled-on');
      this.nextElementSibling.classList.toggle('toggled-on');
      this.setAttribute(
        'aria-expanded',
        this.getAttribute('aria-expanded') === 'false' ? 'true' : 'false'
      );
      screenReaderSpan.forEach(function (el) {
        el.textContent = screenReaderText.expand
          ? screenReaderText.collapse
          : screenReaderText.expand;
      });
    });
  });

  // Adds a class to sub-menus for styling
  var submenus = document.querySelectorAll('.sub-menu .menu-item-has-children');
  submenus.forEach(function (el) {
    // console.log(el.parentNode);
    el.parentNode.classList.add('has-sub-menu');
  });
};

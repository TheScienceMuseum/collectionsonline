// Vendored from smg-web-design-system@0.11.8
// Source: src/js/components/menu.js
// https://github.com/TheScienceMuseum/web-design-system/tree/0.11.8/src/js/components/menu.js
// Date vendored: 2026-10-09
// Reason: the dep ships no dist/ on GitHub-source install, and transpiling its
// ES-module source through babelify + browserify is fragile (see PR). Resync by
// hand if the smg-web-design-system pin is bumped — this file is a verbatim
// copy of the source above with `export default function X()` rewritten as
// `module.exports = function X()`.

/*
This is an adaptation of
https://github.com/argenteum/accessible-nav-wp
Which is used on the SMG blog sites (Wordpress)
Since we're not tied to WP html output, I have applied the extra a11y attributes directly to the html in
/templates/partials/global/global-header.html
but kept the same class names so css can be re-used without much change.
*/

module.exports = function menu () {

  var menuContainers = document.querySelectorAll(".c-menu");
  var toggleExpanded = function (el) {
    el.setAttribute(
      "aria-expanded",
      el.getAttribute("aria-expanded") === "false" ? "true" : "false"
    );
  };
  var mobileNav = document.querySelector(".c-nav-mobile");

  menuContainers.forEach(function (menuContainer) {
    var menuToggle = menuContainer.querySelector(".c-menu__button");

    var screenReaderText = {
      expand: "Expand child menu",
      collapse: "Collapse child menu"
    };

    // menu button toggles either global nav or the mobile copy depending on setup
    if (menuToggle) {
      var menu = document.querySelector(
        "#" + menuToggle.getAttribute("aria-controls")
      );
      menuToggle.addEventListener("click", function () {
        toggleExpanded(this);
        toggleExpanded(menu);
      });
    }

    // If a dropdown has no top-level link (it's dummied to act as group, then skip it from tab order)
    menuContainer.querySelectorAll('[href="#"]').forEach(function (el) {
      el.setAttribute("tabindex", -1);
      el.addEventListener("click", function (e) {
        e.preventDefault();
      });
    });

    menuContainer.querySelectorAll(".c-menu__item--has-children").forEach(function (el) {
      el.addEventListener('mouseenter', (event) => {
        el.querySelector('.c-menu__toggle')?.setAttribute('aria-expanded', 'true');
        el.querySelector('.c-menu__submenu')?.setAttribute('aria-expanded', 'true');
      });
      el.addEventListener('mouseleave', (event) => {
        el.querySelector('.c-menu__toggle')?.setAttribute('aria-expanded', 'false');
        el.querySelector('.c-menu__submenu')?.setAttribute('aria-expanded', 'false');
      });
    })

    // Toggles the sub-menu when dropdown toggle button clicked
    menuContainer.querySelectorAll(".c-menu__toggle").forEach(function (el) {
      el.addEventListener("click", function (e) {
        var screenReaderSpan = this.querySelectorAll(".screen-readers");
        e.preventDefault();
        toggleExpanded(this.nextElementSibling);
        toggleExpanded(this);
        screenReaderSpan.forEach(function (el) {
          el.textContent = screenReaderText.expand
            ? screenReaderText.collapse
            : screenReaderText.expand;
        });
      });
    });
  });
  // in mobile view, remove #links completely and uplevel children. could be done server-side ideally
  if (mobileNav) {
    mobileNav.querySelectorAll('[href="#"]').forEach(function (el) {
      var parentLi = el.parentNode;
      var menu = el.parentNode.parentNode;
      var kids = parentLi.querySelectorAll(".c-menu__submenu li");
      kids.forEach(function (li) {
        menu.appendChild(li);
      });
      menu.removeChild(parentLi);
    });
  }

  document.addEventListener(
    "keyup", (event) => {
      const keyName = event.key;
      if (keyName === "Escape") {
        // WCAG 1.4.13 Content on Hover or Focus
        // A user can get rid of the additional content without moving their pointer or tabbing onto something else (e.g., by hitting the ESC key). This implies you cannot use css :hover alone to show/hide content.
        const menu = document.querySelector('.c-menu__item--has-children:focus-within, .c-menu__item--has-children:hover');
        if (menu) {
          menu.querySelector('.c-menu__toggle').click();
        }
      }
    },
    false,
  );

};

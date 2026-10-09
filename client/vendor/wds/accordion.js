// Vendored from smg-web-design-system@0.11.8
// Source: src/js/components/accordion.js
// https://github.com/TheScienceMuseum/web-design-system/tree/0.11.8/src/js/components/accordion.js
// Date vendored: 2026-10-09
// Reason: the dep ships no dist/ on GitHub-source install, and transpiling its
// ES-module source through babelify + browserify is fragile (see PR). Resync by
// hand if the smg-web-design-system pin is bumped — this file is a verbatim
// copy of the source above with `export default function X()` rewritten as
// `module.exports = function X()`.

module.exports = function accordion () {
  let accordions = document.querySelectorAll(".js-accordion-tab");
  if (accordions) {
    Array.prototype.slice.call(accordions).forEach((el) => {
      el.addEventListener("click", function (e) {
        if (e.target) {
          var content = document.querySelector(
            "#" + e.target.getAttribute("aria-controls"),
          );
          // console.log(content);
          // e.target.classList.toggle("-is-active");
          e.target.setAttribute(
            "aria-expanded",
            e.target.getAttribute("aria-expanded") !== "true",
          );
          // content.style.display = "";
          content.setAttribute(
            "aria-hidden",
            content.getAttribute("aria-hidden") !== "true",
          );
        }
      });
    });
  }
};

module.exports = function() {
  var accordions = document.querySelectorAll(".js-accordion-tab");
  if (accordions) {
    Array.prototype.slice.call(accordions).forEach(el => {
      el.addEventListener("click", function(e) {
        if (e.target) {
          var content = document.querySelector(
            "#" + e.target.getAttribute("aria-controls")
          );
          e.target.setAttribute(
            "aria-expanded",
            e.target.getAttribute("aria-expanded") !== "true"
          );
          content.setAttribute(
            "aria-hidden",
            content.getAttribute("aria-hidden") !== "true"
          );
        }
      });
    });
  }
};

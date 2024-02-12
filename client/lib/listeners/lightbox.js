module.exports = () => {

  var $lightboxes = document.querySelectorAll("[data-lightbox]");
  if ($lightboxes) {

    var createBox = () => {
      let $lightbox = document.getElementById("js-lightbox");
      if ($lightbox) {
        return $lightbox;
      } else {
        var frame = document.createElement("div");
        frame.className = "c-lightbox";
        frame.id = "js-lightbox";
        frame.innerHTML =
          '<button class="c-lightbox__close"><svg class="icon" aria-label="Close image zoom"><use xlink:href="/assets/icons/symbol/svg/sprite.symbol.svg#dismiss"></use></svg></button><img/>';
        document.body.appendChild(frame);
        return document.getElementById("js-lightbox");
      }
    };
    var $lightbox = createBox();

    $lightbox.addEventListener("click", e => {
      $lightbox.classList.remove("is-open");
    });
    document.addEventListener("keydown", e => {
      if (e.code == "KeyX" || e.code == "Escape") {
        $lightbox.classList.remove("is-open");
      }
    });

    $lightboxes.forEach(el => {
      el.addEventListener("click", e => {
        e.preventDefault();

        if (el.hasAttribute("href")) {
          var $img = $lightbox.querySelector("img");
          $img.src = el.href;
          $img.alt = el.getAttribute("title");
          $lightbox.classList.add("is-open");
        }
      });
    });
  }
}

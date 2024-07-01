module.exports = () => {
  const $lightboxes = document.querySelectorAll('[data-lightbox]');
  if ($lightboxes) {
    const createBox = () => {
      const $lightbox = document.getElementById('js-lightbox');
      if ($lightbox) {
        return $lightbox;
      } else {
        const frame = document.createElement('div');
        frame.className = 'c-lightbox';
        frame.id = 'js-lightbox';
        frame.innerHTML =
          '<button class="c-lightbox__close"><svg class="icon" aria-label="Close image zoom"><use xlink:href="/assets/icons/symbol/svg/sprite.symbol.svg#dismiss"></use></svg></button><img/>';
        document.body.appendChild(frame);
        return document.getElementById('js-lightbox');
      }
    };
    const $lightbox = createBox();

    function openLightbox (e) {
      const $img = $lightbox.querySelector('img');
      $img.src = e.detail.src;
      $img.alt = e.detail.alt;
      $lightbox.classList.add('is-open');
    }

    function closeLightbox () {
      $lightbox.classList.remove('is-open');
    }

    $lightbox.addEventListener('click', e => {
      closeLightbox();
    });
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyX' || e.code === 'Escape') {
        closeLightbox();
      }
    });

    // define a custom eventlistener on the document so external scripts can trigger the lightbox
    document.addEventListener('open-lightbox', e => {
      openLightbox(e);
    });

    $lightboxes.forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();

        if (el.hasAttribute('href')) {
          openLightbox({
            detail: {
              src: el.href,
              alt: el.getAttribute('title') || el.querySelector('img').getAttribute('alt')
            }
          });
        }
      });
    });
  }
};

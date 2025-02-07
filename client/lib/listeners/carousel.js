const Flickity = require('flickity');
require('flickity-imagesloaded');

module.exports = ctx => {
  const arrowShape = 'M 0,50 L 45.67,4.33 L 52.5,11.16 L 18.49,45.17 L 100,45.17 L 100,54.83 L 18.49,54.83 L 52.5,88.84 45.67,95.67 Z';
  const carousel = document.querySelector('.carousel');
  if (carousel) {
    const thumbnails = document.getElementsByClassName('record-imgpanel__thumb');
    const captions = Array.prototype.slice.call(
      document.getElementsByClassName('record-imgpanel__caption')
    );
    const rights = Array.prototype.slice.call(
      document.getElementsByClassName('cite__menu__methods')
    );
    const zooms = Array.prototype.slice.call(
      document.getElementsByClassName('osd__toolbar-container')
    );
    const useImage = Array.prototype.slice.call(
      document.getElementsByClassName('cite__button')
    );

    ctx.carousel = new Flickity('.carousel', {
      wrapAround: thumbnails.length >= 3,
      setGallerySize: false,
      pageDots: false,
      imagesLoaded: true,
      lazyLoad: 1,
      arrowShape
    });

    const flkty = Flickity.data(carousel);
    ctx.carousel.on('select', function () {
      if (navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
        document.querySelector('#openseadragon').style.width = '100%';
      }
      Array.prototype.slice.call(thumbnails).forEach(el => {
        el.classList.remove('record-imgpanel__thumb--selected');
      });
      if (thumbnails[flkty.selectedIndex]) {
        thumbnails[flkty.selectedIndex].classList.add(
          'record-imgpanel__thumb--selected'
        );
        captions.forEach(el => showHide('record-imgpanel__caption', flkty, el));
        zooms.forEach(el => showHide('openseadragon-toolbar', flkty, el));
        rights.forEach(el => showHide('cite__method', flkty, el));
        useImage.forEach(el => showHide('cite__button', flkty, el));
      }

      const carouselImage = document.querySelectorAll('.carousel__image.is-selected');

      if (carouselImage.length) {
        ctx.imgUrl = carouselImage[0].dataset.osd;
      }
    });

    Array.prototype.slice.call(thumbnails).forEach((el, i) =>
      el.addEventListener('click', function (e) {
        ctx.carousel.select(i);
      })
    );
  }

  const citeButton = document.getElementsByClassName('cite__button');

  if (citeButton) {
    Array.prototype.slice.call(citeButton).forEach((el, i) =>
      el.addEventListener('click', function (e) {
        document
          .getElementById('cite__menu')
          .classList.toggle('cite__menu--active');
        document
          .getElementById('cite__button-' + i)
          .classList.toggle('cite__button--active');
      })
    );
  }

  // explore-carousel used on home page and explore page.
  const exploreCarousels = document.querySelectorAll('.explore-carousel__flickity');
  exploreCarousels.forEach(function (exploreCarouselel, index) {
    // can't work out why ctx is not defined on the explore page? but this seems safe to do.
    if (!ctx) ctx = { exploreCarousels: [] };

    ctx.exploreCarousels[index] = new Flickity(exploreCarouselel, {
      wrapAround: true,
      pageDots: false,
      imagesLoaded: true,
      lazyLoad: 1,
      cellAlign: 'left',
      percentPosition: false,
      accessibility: true,
      arrowShape,
      on: {
        ready: function () {
          this.select(0);
          // move buttons to before the main carousel
          const buttons = exploreCarouselel.querySelectorAll(
            '.flickity-prev-next-button'
          );
          const before = exploreCarouselel.parentElement.querySelector(
            '.explore-carousel .flickity-buttonholder'
          );
          buttons.forEach(b => {
            before.appendChild(b);
          });

          offsetContainer();
          window.addEventListener('resize', offsetContainer);
          window.addEventListener('orientationchange', offsetContainer);

          // cells contain links, so we need to remove aria-hidden from them
          // https://github.com/metafizzy/flickity/issues/1228
          this.getCellElements().forEach((slide, i) => {
            slide.removeAttribute('aria-hidden');
          });
        },
        change: function () {
          this.getCellElements().forEach((slide, i) => {
            slide.removeAttribute('aria-hidden');
          });
        }
      }
    });
  }
  );

  function offsetContainer () {
    // to mirror main site carousels, we want to bust out of column container on right side only.
    const containerOffset = document.querySelector('.o-container').offsetLeft; // first container will do!
    document.body.style.setProperty('--container-offset', containerOffset + 'px');
  }

  const cardCarousels = document.querySelectorAll('.card-carousel');

  cardCarousels.forEach(function (cardCarousel, index) {
    ctx['cardCarousels' + index] = new Flickity(cardCarousel, {
      wrapAround: true,
      pageDots: true,
      imagesLoaded: true,
      accessibility: true,
      setGallerySize: false,
      arrowShape,
      on: {
        ready: function () {
          // href wrappers don't play nicely with draggable elements
          const links = cardCarousel.querySelectorAll('a');
          links.forEach((link) => {
            link.dataset.lightboxSrc = link.href;
            link.removeAttribute('href');
          });
        },
        staticClick: function (event, pointer, cellElement, cellIndex) {
          if (!cellElement) {
            return;
          }
          document.dispatchEvent(
            new CustomEvent('open-lightbox', {
              detail: {
                src: cellElement.dataset.lightboxSrc,
                alt: cellElement.getAttribute('alt')
              }
            })
          );
        },
        change: function () {
          const copyright = this.selectedElement.dataset.copyright;
          const dd = this.element.closest('article').querySelector('.details-image-copyright');
          if (copyright && dd) dd.innerHTML = copyright;
        }
      }
    });
  });
};

function showHide (idBase, flkty, element) {
  if (element.id === `${idBase}-${flkty.selectedIndex}`) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

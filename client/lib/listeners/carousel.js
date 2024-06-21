const Flickity = require('flickity');
require('flickity-imagesloaded');

module.exports = ctx => {
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
      arrowShape:
        'M 0,50 L 45.67,4.33 L 52.5,11.16 L 18.49,45.17 L 100,45.17 L 100,54.83 L 18.49,54.83 L 52.5,88.84 45.67,95.67 Z'
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

  const homeCarousel = document.querySelector('.home-carousel__flickity');
  if (homeCarousel) {
    const homeCarouselFlkty = new Flickity(homeCarousel, {
      wrapAround: true,
      pageDots: false,
      imagesLoaded: true,
      lazyLoad: 1,
      cellAlign: 'left',
      percentPosition: false,
      accessibility: true,
      arrowShape:
        'M 0,50 L 45.67,4.33 L 52.5,11.16 L 18.49,45.17 L 100,45.17 L 100,54.83 L 18.49,54.83 L 52.5,88.84 45.67,95.67 Z',
      on: {
        ready: function () {
          offsetContainer();
          this.select(0);
          // move buttons to before the main carousel
          const buttons = homeCarousel.querySelectorAll(
            '.flickity-prev-next-button'
          );
          const before = document.querySelector(
            '.home-carousel .flickity-buttonholder'
          );
          buttons.forEach(b => {
            before.appendChild(b);
          });
        }
      }
    });
    homeCarouselFlkty.resize();
    window.addEventListener('resize', offsetContainer);
    window.addEventListener('orientationchange', offsetContainer);
  }
  function offsetContainer () {
    // to mirror main site carousels, we want to bust out of column container on right side only.
    const containerOffset = document.querySelector('.o-container').offsetLeft; // first container will do!
    document.querySelector(
      '.home-carousel__flickity .flickity-viewport'
    ).style.marginLeft =
    containerOffset + 'px';
  }
};

function showHide (idBase, flkty, element) {
  if (element.id === `${idBase}-${flkty.selectedIndex}`) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

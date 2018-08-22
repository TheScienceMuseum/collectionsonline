var Flickity = require('flickity');
require('flickity-imagesloaded');
var openseadragon = require('../openseadragon');

module.exports = (ctx) => {
  var carousel = document.querySelector('.carousel');
  if (carousel) {
    var thumbnails = document.getElementsByClassName('record-imgpanel__thumb');
    var captions = Array.prototype.slice.call(document.getElementsByClassName('record-imgpanel__caption'));
    var rights = Array.prototype.slice.call(document.getElementsByClassName('cite__menu__methods'));
    var zooms = Array.prototype.slice.call(document.getElementsByClassName('osd__toolbar-container'));
    var useImage = Array.prototype.slice.call(document.getElementsByClassName('cite__button'));

    ctx.carousel = new Flickity('.carousel', {
      wrapAround: thumbnails.length >= 3,
      setGallerySize: false,
      pageDots: false,
      imagesLoaded: true,
      lazyLoad: 1,
      arrowShape:
        'M 0,50 L 45.67,4.33 L 52.5,11.16 L 18.49,45.17 L 100,45.17 L 100,54.83 L 18.49,54.83 L 52.5,88.84 45.67,95.67 Z'
    });

    var flkty = Flickity.data(carousel);
    ctx.carousel.on('select', function () {
      if (navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
        document.querySelector('#openseadragon').style.width = '100%';
      }
      Array.prototype.slice.call(thumbnails).forEach((el) => {
        el.classList.remove('record-imgpanel__thumb--selected');
      });
      if (thumbnails[flkty.selectedIndex]) {
        thumbnails[flkty.selectedIndex].classList.add('record-imgpanel__thumb--selected');
        captions.forEach((el) => showHide('record-imgpanel__caption', flkty, el));
        zooms.forEach((el) => showHide('openseadragon-toolbar', flkty, el));
        rights.forEach((el) => showHide('cite__method', flkty, el));
        useImage.forEach((el) => showHide('cite__button', flkty, el));
      }
    });

    Array.prototype.slice.call(thumbnails).forEach((el, i) => el.addEventListener('click', function (e) {
      ctx.carousel.select(i);
      if (ctx.viewer) {
        openseadragon.init(ctx, e.target.src);
      }
    }));
  }

  var citeButton = document.getElementsByClassName('cite__button');

  if (citeButton) {
    Array.prototype.slice.call(citeButton).forEach((el, i) => el.addEventListener('click', function (e) {
      document.getElementById('cite__menu').classList.toggle('cite__menu--active');
      document.getElementById('cite__button-' + i).classList.toggle('cite__button--active');
    }));
  }
};

function showHide (idBase, flkty, element) {
  if (element.id === `${idBase}-${flkty.selectedIndex}`) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

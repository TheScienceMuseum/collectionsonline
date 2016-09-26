var Flickity = require('flickity');
require('flickity-imagesloaded');
var openseadragon = require('./openseadragon');

module.exports = (ctx) => {
  var carousel = document.querySelector('.carousel');
  if (carousel) {
    var thumbnails = document.getElementsByClassName('record-imgpanel__thumb');
    var captions = Array.prototype.slice.call(document.getElementsByClassName('record-imgpanel__caption'));
    var rights = Array.prototype.slice.call(document.getElementsByClassName('cite__menu__methods'));

    ctx.carousel = new Flickity('.carousel', {
      wrapAround: thumbnails.length >= 3,
      setGallerySize: false,
      pageDots: false,
      imagesLoaded: true,
      lazyLoad: 1,
      arrowShape: {
        x0: 30,
        x1: 63.5, y1: 50,
        x2: 70, y2: 45.5,
        x3: 40
      }
    });

    var flkty = Flickity.data(carousel);
    ctx.carousel.on('select', function () {
      Array.prototype.slice.call(thumbnails).forEach((el, i) => el.classList.remove('record-imgpanel__thumb--selected'));
      thumbnails[flkty.selectedIndex].classList.add('record-imgpanel__thumb--selected');
      captions.forEach(showHide.bind(null, 'record-imgpanel__caption', flkty));
      rights.forEach(showHide.bind(null, 'cite__method', flkty));
    });

    Array.prototype.slice.call(thumbnails).forEach((el, i) => el.addEventListener('click', function (e) {
      ctx.carousel.select(i);
      if (ctx.viewer) {
        ctx.viewer.destroy();
        ctx.viewer = false;
        ctx.save();
        openseadragon.init(ctx, e.target.src);
      }
    }));

    var citeButton = document.getElementById('cite__button');

    if (citeButton) {
      citeButton.addEventListener('click', function (e) {
        document.getElementById('cite__menu').classList.toggle('cite__menu--active');
        document.getElementById('cite__button').classList.toggle('cite__button--active');
      });
    }
  }
};

function showHide (idBase, flkty, element) {
  if (element.id === `${idBase}-${flkty.selectedIndex}`) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

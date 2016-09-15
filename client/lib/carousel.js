var Flickity = require('flickity');
require('flickity-imagesloaded');
var openseadragon = require('./openseadragon');

module.exports = (ctx) => {
  if (document.querySelector('.carousel')) {
    var thumbnails = document.getElementsByClassName('carousel-thumb');

    ctx.carousel = new Flickity('.carousel', {
      wrapAround: true,
      setGallerySize: false,
      pageDots: false
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

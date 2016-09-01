/*eslint-disable no-unused-vars*/
var Carousel = require('carousel-js');
var openseadragon = require('./openseadragon');

module.exports = (ctx) => {
  var thumbnails = document.getElementsByClassName('carousel-thumb');

  var carousel = new Carousel({
    panels: document.getElementsByClassName('carousel-image'),
    panelActiveClass: 'carousel-image-active',
    leftArrow: document.getElementById('left-button'),
    rightArrow: document.getElementById('right-button'),
    infinite: true,
    thumbnails: thumbnails
  });

  Array.prototype.slice.call(document.getElementsByClassName('carousel-thumb')).forEach(el => el.addEventListener('click', function (e) {
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
};

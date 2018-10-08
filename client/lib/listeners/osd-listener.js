var openseadragon = require('../openseadragon');

module.exports = ctx => {
  var osd =
    Array.prototype.slice.call(
      document.getElementsByClassName('osd__toolbar')
    ) || [];
  var singleImages =
    Array.prototype.slice.call(
      document.getElementsByClassName('single_image')
    ) || [];
  var thingsToInit = osd.concat(singleImages);

  var initOSD = function () {
    var rotateButtons = document.querySelectorAll('.osd-rotate');
    var zoomButtons = document.querySelectorAll('.osd-zoom');
    var allButtons = Array.prototype.slice
      .call(rotateButtons)
      .concat(Array.prototype.slice.call(zoomButtons));

    allButtons.forEach(function (el) {
      el.classList.remove('hidden');
    });

    openseadragon.init(ctx);
    ctx.viewer.setFullScreen(true);
  };

  if (ctx.carousel) {
    ctx.carousel.on('staticClick', () => {
      initOSD();
    });
  }

  thingsToInit.forEach(function (el) {
    el.addEventListener('click', () => {
      if (!ctx.viewer) initOSD();
    });
  });
};

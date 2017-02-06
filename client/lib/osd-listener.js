var openseadragon = require('../lib/openseadragon');

module.exports = (ctx) => {
  var osd = Array.prototype.slice.call(document.getElementsByClassName('osd__toolbar')) || [];
  var singleImages = Array.prototype.slice.call(document.getElementsByClassName('single_image')) || [];
  var selectedImages = Array.prototype.slice.call(document.getElementsByClassName('flickity-viewport')) || [];
  var images = osd.concat(singleImages).concat(selectedImages);

  images.forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (!ctx.viewer) {
        openseadragon.init(ctx);
      }
      ctx.viewer.setFullScreen(true);
      if (e.target.id === 'osd-home') {
        openseadragon.quit(ctx);
      }
    });
  });
};

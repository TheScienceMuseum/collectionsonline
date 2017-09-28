var OpenSeadragon = require('openseadragon');

module.exports = {
  init: function (ctx, imgUrl, cb) {
    var openseadragon = document.querySelector('#openseadragon');
    openseadragon.classList.remove('hidden');
    if (!openseadragon) return;

    var carouselImage = document.querySelectorAll('.carousel__image.is-selected');
    var singleImage = document.querySelectorAll('.single_image');

    if (!imgUrl) {
      if (carouselImage.length) {
        imgUrl = carouselImage[0].dataset.osd;
      } else if (singleImage) {
        imgUrl = singleImage[0].dataset.osd;
      }
    }

    if (ctx.viewer) {
      ctx.viewer.open(imgUrl + '.dzi');
    } else {
      ctx.viewer = OpenSeadragon({
        id: 'openseadragon',
        prefixUrl: '/assets/img/openseadragon/',
        showZoomControl: true,
        tileSources: imgUrl + '.dzi',
        zoomInButton: 'osd-zoomin',
        zoomOutButton: 'osd-zoomout',
        fullPageButton: 'osd-fullpage',
        rotateRightButton: 'osd-rotate-right',
        rotateLeftButton: 'osd-rotate-left',
        homeButton: 'osd-home',
        toolbar: 'openseadragon-toolbar',
        gestureSettingsMouse: {
          scrollToZoom: false
        },
        showRotationControl: true
      });

      ctx.viewer.addHandler('full-screen', function (e) {
        if (e.fullScreen) {
          e.eventSource.gestureSettingsMouse.scrollToZoom = true;
        } else {
          e.eventSource.gestureSettingsMouse.scrollToZoom = false;
          this.quit(ctx);
        }
      }.bind(this));

      ctx.save();
    }
  },

  quit: function (ctx) {
    var openseadragon = document.querySelector('#openseadragon');
    var rotateButtons = document.querySelectorAll('.osd-rotate');
    var zoomButtons = document.querySelectorAll('.osd-zoom');
    var allButtons = Array.prototype.slice.call(rotateButtons).concat(Array.prototype.slice.call(zoomButtons));

    openseadragon.classList.add('hidden');
    allButtons.forEach(function (el) {
      el.classList.add('hidden');
    });
  }
};

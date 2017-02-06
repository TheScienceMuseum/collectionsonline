require('openseadragon');

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

    if (!ctx.viewer) {
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

    openseadragon.classList.add('hidden');
    Array.prototype.slice.call(rotateButtons).forEach(function (el) {
      el.classList.add('hidden');
    });
    ctx.viewer.destroy();
    ctx.viewer = false;
    ctx.save();
  }
};

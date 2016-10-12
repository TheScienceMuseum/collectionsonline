require('openseadragon');

module.exports = {
  init: function (ctx, imgUrl, cb) {
    imgUrl = imgUrl || document.querySelectorAll('.carousel__image.is-selected')[0].dataset.osd;
    var openseadragon = document.querySelector('#openseadragon');
    if (!openseadragon) return;

    if (!ctx.viewer) {
      ctx.viewer = OpenSeadragon({
        id: 'openseadragon',
        prefixUrl: '/assets/img/openseadragon/',
        showZoomControl: true,
        tileSources: imgUrl + '.dzi',
        zoomInButton: 'osd-zoomin',
        zoomOutButton: 'osd-zoomout',
        fullPageButton: 'osd-fullpage',
        homeButton: 'osd-home',
        toolbar: 'openseadragon-toolbar',
        gestureSettingsMouse: {
          scrollToZoom: false
        }
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
    ctx.viewer.destroy();
    ctx.viewer = false;
    ctx.save();
  }
};

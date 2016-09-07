require('openseadragon');

module.exports = {
  init: function (ctx, imgUrl, cb) {
    imgUrl = imgUrl || document.querySelectorAll('.carousel-image-active')[0].src;
    var openseadragon = document.querySelector('#openseadragon');
    if (!openseadragon) return;

    if (!ctx.viewer) {
      document.querySelector('.record-imgpanel__slickwrap').classList.add('hidden');
      document.querySelector('.record-imgpanel__dragon').classList.remove('hidden');

      ctx.viewer = OpenSeadragon({
        id: 'openseadragon',
        prefixUrl: '/assets/img/openseadragon/',
        showZoomControl: true,
        tileSources: {
          type: 'image',
          url: imgUrl
        },
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
        }
      });

      document.querySelector('#openseadragon .pic').style.display = 'none';

      ctx.save();
    }
  },

  quit: function (ctx) {
    ctx.viewer.destroy();
    ctx.viewer = false;
    ctx.save();
    document.querySelector('.record-imgpanel__slickwrap').classList.remove('hidden');
    document.querySelector('.record-imgpanel__dragon').classList.add('hidden');
  }
};

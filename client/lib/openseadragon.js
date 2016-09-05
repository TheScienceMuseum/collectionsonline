require('openseadragon');
var $ = require('jquery');

module.exports = {
  init: function (ctx, imgUrl, cb) {
    imgUrl = imgUrl || $('.carousel-image-active')[0].src;
    if (!$('#openseadragon').length) return;

    if (!ctx.viewer) {
      $('.record-imgpanel__slickwrap').addClass('hidden');
      $('.record-imgpanel__dragon').removeClass('hidden');

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

      $('#openseadragon .pic').hide();

      ctx.save();
    }
  },

  quit: function (ctx) {
    ctx.viewer.destroy();
    ctx.viewer = false;
    ctx.save();
    $('.record-imgpanel__slickwrap').removeClass('hidden');
    $('.record-imgpanel__dragon').addClass('hidden');
  }
};

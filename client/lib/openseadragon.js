require('openseadragon');
var $ = require('jquery');

module.exports = function (imgUrl, ctx) {
  if (!$('#openseadragon').length) return;

  ctx.viewer = OpenSeadragon({
    id: 'openseadragon',
    // element: $('.record-imgpanel__singleimg'),
    prefixUrl: '/assets/img/openseadragon/',
    showZoomControl: true,
    // just using an example static image, will be swapped for some magic tiles
    tileSources: {
      type: 'image',
      url: imgUrl
    }
  });
  // hide fallback non-zoomable img
  $('#openseadragon .pic').hide();
  ctx.save();
};

var OpenSeadragon = require('openseadragon');
var $ = require('jquery');

module.exports = function () {
  if (!$('#openseadragon').length) return;

  OpenSeadragon({
    id: 'openseadragon',
    // element: $('.record-imgpanel__singleimg'),
    prefixUrl: '/assets/img/openseadragon/',
    toolbar: 'openseadragon-toolbar',
    zoomOutButton: 'osd-zoomout',
    zoomInButton: 'osd-zoomin',
    homeButton: 'osd-home',
    fullPageButton: 'osd-fullpage',
    // just using an example static image, will be swapped for some magic tiles
    tileSources: {
      type: 'image',
      url: '/assets/img/example/babbage/Babbages-Difference-Engine-No-2-1847-1849-drawings1111.jpg'
    }
  });
  // hide fallback non-zoomable img
  $('#openseadragon .pic').hide();
};

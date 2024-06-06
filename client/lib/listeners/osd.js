const OpenSeadragon = require('openseadragon');

module.exports = (ctx) => {
  const openseadragon = document.querySelector('#openseadragon');
  // if (openseadragon && ctx.imgUrl) {
  if (openseadragon) {
    const carouselImage = document.querySelectorAll(
      '.carousel__image.is-selected'
    );
    const singleImage = document.querySelectorAll('.single_image');
    if (!ctx.imgUrl) {
      if (!carouselImage.length && singleImage) {
        ctx.imgUrl = singleImage[0].dataset.osd;
      } else if (carouselImage.length) {
        ctx.imgUrl = carouselImage[0].dataset.osd;
      }
    }

    if (document.getElementById('openseadragon-toolbar')) {
      // to handle edge case where a record doesn't have zooms and can't dynamically generate '#openseadragon-toolbar', which is checked in record-imgpanel_controlbar.html
      ctx.viewer = OpenSeadragon({
        id: 'openseadragon',
        crossOriginPolicy: 'Anonymous',
        ajaxWithCredentials: false,
        prefixUrl: '/assets/img/openseadragon/',
        showZoomControl: true,
        animationTime: 0.15,
        blendTime: 0,
        constrainDuringPan: false,
        controlsFadeAfterInactive: 1500,
        controlsFadeDelay: 250,
        controlsFadeLength: 250,
        defaultZoomLever: 0,
        immediateRender: false,
        maxZoomPixelRatio: 1.25,
        preload: false,
        tileSources: ctx.imgUrl + '/info.json',
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
    } else {
      return;
    }

    ctx.viewer.addHandler('full-screen', function (e) {
      if (e.fullScreen) {
        e.eventSource.gestureSettingsMouse.scrollToZoom = true;
        show();
      } else {
        e.eventSource.gestureSettingsMouse.scrollToZoom = false;
        hide();
      }
    });

    const osd =
      Array.prototype.slice.call(
        document.getElementsByClassName('osd__toolbar')
      ) || [];

    const singleImages =
      Array.prototype.slice.call(
        document.getElementsByClassName('single_image')
      ) || [];

    const thingsToInit = osd.concat(singleImages);
    // const thingsToInit = singleImages;

    // for click on carousel itself
    if (ctx.carousel) {
      ctx.carousel.on('staticClick', () => {
        show();
        ctx.viewer.open(ctx.imgUrl + '/info.json');
        ctx.viewer.setFullScreen(true);
      });
    }

    thingsToInit.forEach(function (el) {
      el.addEventListener('click', () => {
        show();
        // ctx.viewer.tileSources.append(ctx.imgUrl + '/info.json');
        // ctx.viewer.open(ctx.imgUrl + '/info.json');
        ctx.viewer.setFullScreen(true);
      });
    });
  }
};

function show () {
  openseadragonElements().forEach(function (el) {
    el.classList.remove('hidden');
  });
}

function hide () {
  openseadragonElements().forEach(function (el) {
    el.classList.add('hidden');
  });
}

function openseadragonElements () {
  const openseadragon = document.querySelectorAll('#openseadragon');
  const rotateButtons = document.querySelectorAll('.osd-rotate');
  const zoomButtons = document.querySelectorAll('.osd-zoom');
  return Array.prototype.slice
    .call(rotateButtons)
    .concat(Array.prototype.slice.call(zoomButtons))
    .concat(Array.prototype.slice.call(openseadragon));
}

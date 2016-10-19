var openseadragon = require('../lib/openseadragon');

module.exports = (ctx) => {
  var osd = document.getElementById('openseadragon-toolbar');
  if (osd) {
    osd.addEventListener('click', function (e) {
      if (!ctx.viewer) {
        openseadragon.init(ctx);
      }
      if (e.target.id === 'osd-fullpage') {
        ctx.viewer.setFullScreen(true);
      } else if (e.target.id === 'osd-home') {
        openseadragon.quit(ctx);
      }
    });
  }
};

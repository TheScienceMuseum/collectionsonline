var openseadragon = require('../lib/openseadragon');

module.exports = (ctx) => {
  document.getElementById('openseadragon-toolbar').addEventListener('click', function (e) {
    if (!ctx.viewer) {
      openseadragon.init(ctx);
    }
    if (e.target.id === 'osd-fullpage') {
      ctx.viewer.setFullScreen(true);
    } else if (e.target.id === 'osd-home') {
      openseadragon.quit(ctx);
    }
  });
};

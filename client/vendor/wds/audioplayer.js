// Vendored from smg-web-design-system@0.11.8
// Source: src/js/components/audioplayer.js
// https://github.com/TheScienceMuseum/web-design-system/tree/0.11.8/src/js/components/audioplayer.js
// Date vendored: 2026-10-09
// Reason: the dep ships no dist/ on GitHub-source install, and transpiling its
// ES-module source through babelify + browserify is fragile (see PR). Resync by
// hand if the smg-web-design-system pin is bumped — this file is a verbatim
// copy of the source above with `import Plyr from "..."` rewritten as a
// `require()` (plyr is a direct dep of this project) and `export default` as
// `module.exports`.

const Plyr = require("plyr/dist/plyr.polyfilled.js");

module.exports = function audioplayer () {
  var audioplayer = document.querySelector(".c-audioplayer");
  if (audioplayer !== null) {
    var player = new Plyr(".c-audioplayer audio");
    var button = document.querySelector(".c-audioplayer__button");
    player.on("playing", event => {
      audioplayer.classList.add("c-audioplayer--playing");
      button.setAttribute("aria-label", "Pause audio");
    });
    player.on("pause", event => {
      audioplayer.classList.remove("c-audioplayer--playing");
      button.setAttribute("aria-label", "Play audio");
    });
    player.on("ended", event => {
      audioplayer.classList.remove("c-audioplayer--playing");
      button.setAttribute("aria-label", "Play audio");
    });

    button.addEventListener("click", event => {
      player.togglePlay();
    });
  }
};

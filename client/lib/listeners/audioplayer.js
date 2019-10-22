// This file is based on  smg-web-design-system/src/js/components/audioplayer
// but requiry instead of importy

var Plyr = require("plyr/dist/plyr.polyfilled.js");

module.exports = () => {
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

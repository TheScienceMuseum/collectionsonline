// This file is based on  smg-web-design-system/src/js/components/audioplayer
// but requiry instead of importy

var Plyr = require("plyr/dist/plyr.polyfilled.js");

module.exports = () => {
  var player = new Plyr(".c-audioplayer audio");
  var stateClass = document.querySelector(".c-audioplayer").classList;
  player.on("playing", event => {
    stateClass.add("c-audioplayer--playing");
  });
  player.on("pause", event => {
    stateClass.remove("c-audioplayer--playing");
  });
  player.on("ended", event => {
    stateClass.remove("c-audioplayer--playing");
  });

  var button = document.querySelector(".c-audioplayer__button");
  button.addEventListener("click", function(e) {
    player.togglePlay();
  });
};

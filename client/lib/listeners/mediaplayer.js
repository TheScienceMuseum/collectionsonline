module.exports = () => {
  var mediaplayer = document.querySelector('.mediaplayer');
  if (mediaplayer) {
    var embeds = [].slice.call(
      mediaplayer.querySelectorAll('.mediaplayer__embed')
    );
    var playlist = [].slice.call(
      mediaplayer.querySelectorAll('.mediaplayer__listitem')
    );

    var setActive = function (el, i) {
      el.classList.add('--active');
      var iframe = embeds[i].querySelector('iframe');
      if (!iframe.src) iframe.src = iframe.dataset.src;
      embeds[i].classList.add('--active');
    };

    playlist.forEach(function (el, i) {
      if (i === 0) {
        setActive(el, i);
      }
      el.addEventListener('click', function (event) {
        swapActive(event, el, i);
      });
    });

    var swapActive = function (event, el, i) {
      event.preventDefault();
      var current = mediaplayer.querySelectorAll('.--active');
      [].forEach.call(current, function (el) {
        el.classList.remove('--active');
      });
      setActive(el, i);

      // pause videos on inactive tabs, play them on select.
      if (players) {
        Object.keys(players).forEach(function (key) {
          players[key].pauseVideo();
        });
      }
      if (embeds[i].dataset.type === 'youtube') {
        var thisPlayer = embeds[i].querySelector('iframe').id;
        players[thisPlayer].playVideo();
      }
    };

    // Only if we have youtubes, add the API to be able to control play state.
    var videos = document.querySelectorAll('[data-type=youtube] iframe');
    if (videos) {
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      var players = [];
      window.onYouTubeIframeAPIReady = function () {
        [].forEach.call(videos, function (el) {
          players[el.id] = new YT.Player(el); // eslint-disable-line
        });
      };
    }
  }
};

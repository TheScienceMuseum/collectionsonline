module.exports = () => {
  const mediaplayer = document.querySelector('.mediaplayer');
  if (mediaplayer) {
    const embeds = [].slice.call(
      mediaplayer.querySelectorAll('.mediaplayer__embed')
    );
    const playlist = [].slice.call(
      mediaplayer.querySelectorAll('.mediaplayer__listitem')
    );

    const setActive = function (el, i) {
      el.classList.add('mediaplayer--active');
      const iframe = embeds[i].querySelector('iframe');
      if (!iframe.src) iframe.src = iframe.dataset.src;
      embeds[i].classList.add('mediaplayer--active');
    };

    playlist.forEach(function (el, i) {
      if (i === 0) {
        setActive(el, i);
      }
      el.addEventListener('click', function (event) {
        swapActive(event, el, i);
      });
    });

    const swapActive = function (event, el, i) {
      event.preventDefault();
      const current = mediaplayer.querySelectorAll('.mediaplayer--active');
      [].forEach.call(current, function (el) {
        el.classList.remove('mediaplayer--active');
      });
      setActive(el, i);

      // Jamie / 16th Oct 2023
      // Where are player assigned. Ask Toby?
      // pause videos on inactive tabs, play them on select.
      // if (players) {
      //   Object.keys(players).forEach(function (key) {
      //     players[key].pauseVideo();
      //   });
      // }
      // if (embeds[i].dataset.type === 'youtube') {
      //   const thisPlayer = embeds[i].querySelector('iframe').id;
      //   players[thisPlayer].playVideo();
      // }
    };

    // Only if we have youtubes, add the API to be able to control play state.
    const videos = document.querySelectorAll('[data-type=youtube] iframe');
    if (videos) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      const players = [];
      window.onYouTubeIframeAPIReady = function () {
        [].forEach.call(videos, function (el) {
          players[el.id] = new YT.Player(el); // eslint-disable-line
        });
      };
    }
  }
};

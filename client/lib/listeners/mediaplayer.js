module.exports = () => {
  var mediaplayer = document.querySelector('.mediaplayer');
  if (mediaplayer) {
    var embeds = [].slice.call(
      mediaplayer.querySelectorAll('.mediaplayer__embed')
    );
    var playlist = [].slice.call(
      mediaplayer.querySelectorAll('.mediaplayer__listitem')
    );

    var swapActive = function (event, el, i) {
      event.preventDefault();
      var current = mediaplayer.querySelectorAll('.--active');
      [].forEach.call(current, function (el) {
        el.classList.remove('--active');
      });
      el.classList.add('--active');
      embeds[i].classList.add('--active');
    };

    playlist.forEach(function (el, i) {
      if (i === 0) {
        el.classList.add('--active');
        embeds[i].classList.add('--active');
      }
      el.addEventListener('click', function (event) {
        swapActive(event, el, i);
      });
    });
  }
};

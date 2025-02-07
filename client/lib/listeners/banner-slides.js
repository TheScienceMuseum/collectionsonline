module.exports = ctx => {
  const bannerSlides = document.querySelectorAll('.banner-slides');
  bannerSlides.forEach(banner => {
    const panX = ['left', 'right', 'center'];
    const panY = ['top', 'bottom', 'center'];

    const init = () => {
      // the first image is preloaded as fallback. template images do not load until in the DOM
      const template = banner.querySelector('template');
      banner.innerHTML = template.innerHTML;

      banner.querySelectorAll('img').forEach(el => {
        el.addEventListener('animationend', (event) => {
          if (event.animationName === 'fade') {
            event.target.classList.remove('fade', 'pan');
            banner.prepend(banner.querySelector('img:last-of-type'));
            startAnimation();
          }
        });
        el.style.setProperty('--pan-x', panX[Math.floor(Math.random() * panX.length)]);
        el.style.setProperty('--pan-y', panY[Math.floor(Math.random() * panY.length)]);
      });

      banner.querySelector('button').addEventListener('click', (event) => {
        banner.classList.toggle('paused');
        const icon = event.target.querySelector('use');
        const path = icon.getAttribute('xlink:href')?.split('#');
        icon.setAttribute('xlink:href',
          banner.classList.contains('paused')
            ? path[0] + '#play'
            : path[0] + '#pause'
        );
        event.target.setAttribute('aria-label',
          banner.classList.contains('paused')
            ? 'Play background animation'
            : 'Pause background animation'
        );
      });
    };

    const startAnimation = () => {
      const thisImage = banner.querySelector('img:last-of-type');
      thisImage.classList.add('fade', 'pan');
      const nextImage = thisImage.previousElementSibling;
      nextImage.classList.add('pan');
    };

    init();
    startAnimation();
  });
};

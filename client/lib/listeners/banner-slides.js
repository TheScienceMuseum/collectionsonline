module.exports = ctx => {
  const bannerSlides = document.querySelectorAll('.banner-slides');
  bannerSlides.forEach(banner => {

    const panX = ['left', 'right', 'center'];
    const panY = ['top', 'bottom', 'center'];

    const init = () => {
      // the first image is preloaded as fallback. template images do not load until in the DOM 
      // replace the existing contents of banner with the nodes inside the template
      const template = banner.querySelector('template');
      banner.innerHTML = template.innerHTML;

      banner.querySelectorAll('img').forEach(el => {
        el.addEventListener("animationend", (event) => {
          if (event.animationName == 'fade') {
            event.target.classList.remove('fade', 'pan');
            banner.prepend(banner.lastElementChild);
            startAnimation();
          }
        });
        el.style.setProperty('--pan-x', panX[Math.floor(Math.random() * panX.length)]);
        el.style.setProperty('--pan-y', panY[Math.floor(Math.random() * panY.length)]);
      })
    }

    const startAnimation = () => {
      const thisImage = banner.lastElementChild;
      thisImage.classList.add('fade', 'pan');
      const nextImage = thisImage.previousElementSibling;
      nextImage.classList.add('pan');
    }

    init();
    startAnimation();

  })

}

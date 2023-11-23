module.exports = function () {
  const maplinks = [].slice.call(document.querySelectorAll('.smg-map__map a'));
  const desc = document.querySelector('.smg-map__desc');
  if (desc && maplinks.length) {
    const initialdesc = desc.innerHTML;
    maplinks.forEach(el => {
      el.addEventListener('mouseover', function (e) {
        const hoverdesc = el.getAttribute('title');
        desc.innerHTML = hoverdesc;
      });
      el.addEventListener('mouseout', function (e) {
        desc.innerHTML = initialdesc;
      });
    });
  }
};

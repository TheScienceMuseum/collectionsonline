module.exports = function () {
  var maplinks = [].slice.call(document.querySelectorAll('.smg-map__map a'));
  var desc = document.querySelector('.smg-map__desc');
  var logo = document.querySelector('.smg-map__logo');
  var smglogo = logo.querySelector('svg');
  if (desc && maplinks.length) {
    var initialdesc = desc.innerHTML;
    maplinks.forEach(el => {
      el.addEventListener('mouseover', function (e) {
        var hoverdesc = el.getAttribute('title');
        desc.innerHTML = hoverdesc;
        var hoverlogo = el.querySelector('svg');
        var hoverlogocopy = hoverlogo.cloneNode(true);
        logo.replaceChild(hoverlogocopy, logo.querySelector('svg'));
      });
      el.addEventListener('mouseout', function (e) {
        desc.innerHTML = initialdesc;
        logo.replaceChild(smglogo, logo.querySelector('svg'));
      });
    });
  }
};

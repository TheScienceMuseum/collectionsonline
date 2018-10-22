module.exports = function () {
  var maplinks = [].slice.call(document.querySelectorAll('.smg-map__map a'));
  var desc = document.querySelector('.smg-map__desc');
  if (desc && maplinks.length) {
    var initialdesc = desc.innerHTML;
    maplinks.forEach(el => {
      el.addEventListener('mouseover', function (e) {
        var hoverdesc = el.getAttribute('title');
        desc.innerHTML = hoverdesc;
      });
      el.addEventListener('mouseout', function (e) {
        desc.innerHTML = initialdesc;
      });
    });
  }
};

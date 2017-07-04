'use strict';

function toggle (e) {
  var button = e.target;
  var detailElem = button.parentElement.querySelector('dd.toggle-detail');

  if (detailElem.className.indexOf('hidden') === -1) {
    detailElem.classList.add('hidden');
    button.innerText = 'Show \u2193';
  } else {
    detailElem.classList.remove('hidden');
    button.innerText = 'Hide \u2192';
  }
}

module.exports = function () {
  var hideThis = document.querySelectorAll('.hide-this');
  [].forEach.call(hideThis, function (el) {
    el.addEventListener('click', toggle);
  });
};

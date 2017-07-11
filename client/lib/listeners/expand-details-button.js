'use strict';

function toggle (e) {
  var button = e.target;
  var detailElem = button.parentElement.querySelector('dd.toggle-detail');

  if (detailElem.className.indexOf('hidden') === -1) {
    detailElem.classList.add('hidden');
    button.innerText = 'Show';
    button.setAttribute('aria-expanded', false);
  } else {
    detailElem.classList.remove('hidden');
    button.innerText = 'Hide';
    button.setAttribute('aria-expanded', true);
  }
}

module.exports = function () {
  var hideThis = document.querySelectorAll('.record-details__toggler');
  [].forEach.call(hideThis, function (el) {
    el.addEventListener('click', toggle);
  });
};

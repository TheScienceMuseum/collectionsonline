'use strict';

function toggle (e) {
  const button = e.target;
  const detailElem = button.parentElement.querySelector('dd.toggle-detail');

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
  const hideThis = document.querySelectorAll('.record-details__toggler');
  [].forEach.call(hideThis, function (el) {
    el.addEventListener('click', toggle);
  });
};

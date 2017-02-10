'use strict';

var toogle = function (elt, button) {
  if (elt.style.display === 'none' || elt.style.display === '') {
    elt.style.display = 'block';
    button.innerText = 'Hide \u2192';
  } else {
    elt.style.display = 'none';
    button.innerText = 'Show \u2193';
  }
};

module.exports = function () {
  var body = document.querySelector('body');

  body.addEventListener('click', function (e) {
    if (e.target && e.target.className === 'hide-this') {
      toogle(e.target.parentElement.querySelector('dd'), e.target);
    }
  });
};


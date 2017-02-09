'use strict';

var toogle = function (elt) {
  if (elt.style.display === 'none' || elt.style.display === '') {
    elt.style.display = 'block';
  } else {
    elt.style.display = 'none';
  }
};

module.exports = function () {
  var body = document.querySelector('body');

  body.addEventListener('click', function (e) {
    if (e.target && e.target.className === 'hide-this') {
      toogle(e.target.parentElement.querySelector('dd'));
    }
  });
};


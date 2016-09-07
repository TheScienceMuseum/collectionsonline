module.exports = function () {
  var body = document.querySelector('body');
  body.addEventListener('click', function (e) {
    if (e.target && e.target.className === 'details__summary') {
      var parentElement = e.target.parentElement;
      var attributeValue = parentElement.getAttribute('aria-expanded') !== 'true';
      parentElement.setAttribute('aria-expanded', attributeValue);
    }
  });
};

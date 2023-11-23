module.exports = function () {
  const body = document.querySelector('body');
  body.addEventListener('click', function (e) {
    if (e.target && e.target.className === 'details__summary') {
      const parentElement = e.target.parentElement;
      const attributeValue = parentElement.getAttribute('aria-expanded') !== 'true';
      parentElement.setAttribute('aria-expanded', attributeValue);
    }
  });
};

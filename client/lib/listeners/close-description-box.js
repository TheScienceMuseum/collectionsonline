module.exports = function () {
  function select (elem) { return document.querySelector(elem); }

  var closeDescriptionButton = select('button[name=close-description-box]');

  if (closeDescriptionButton) {
    closeDescriptionButton.addEventListener('click', function (e) {
      var descriptionBox = select('.description-box');
      descriptionBox.classList.add('hidden');
    });
  }
};

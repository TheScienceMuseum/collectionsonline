module.exports = function () {
  function select (elem) { return document.querySelector(elem); }

  const closeDescriptionButton = select('button[name=close-description-box]');

  if (closeDescriptionButton) {
    closeDescriptionButton.addEventListener('click', function (e) {
      const descriptionBox = select('.description-box');
      descriptionBox.classList.add('hidden');
    });
  }
};

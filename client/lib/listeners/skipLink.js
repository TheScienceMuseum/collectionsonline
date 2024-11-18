module.exports = () => {
  document
    .getElementById('skip-link')
    .addEventListener('click', function (event) {
      event.preventDefault();

      const target = document.getElementById('main-content');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        target.focus();
      }
    });
};

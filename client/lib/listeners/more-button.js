module.exports = function () {
  const details = document.querySelectorAll('details');
  details.forEach((el) => {
    el.addEventListener('toggle', function (e) {
      if (e.target && e.target.className === 'c-truncated') {
        const summary = e.target.querySelector('summary');
        summary.innerHTML = e.target.hasAttribute('open') ? 'Less' : 'More';
      }
    });
  });
};

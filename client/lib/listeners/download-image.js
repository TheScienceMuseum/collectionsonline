module.exports = () => {
  const download = document.querySelectorAll('.download-image');
  const a = document.createElement('a');
  if (download) {
    Array.prototype.slice.call(download).forEach(e => {
      e.addEventListener('submit', event => {
        if (typeof a.download !== 'undefined') {
          event.preventDefault();
          a.href = e.action;
          a.download = 'image.jpeg';
          document.body.appendChild(a);
          a.click();
        }
      });
    });
  }
};

module.exports = () => {
  var download = document.querySelector('#download-image');
  var a = document.createElement('a');
  if (download) {
    download.addEventListener('submit', e => {
      if (typeof a.download !== undefined) {
        e.preventDefault();
        a.href = download.action;
        a.download = 'image.jpeg';
        a.click();
      }
    });
  }
};

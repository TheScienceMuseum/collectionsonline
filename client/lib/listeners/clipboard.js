const Clipboard = require('clipboard');

module.exports = function () {
  // using https://clipboardjs.com/ because even in 2024 the native clipboard API is not supported in all browsers

  const clipboard = new Clipboard('.clipboard__button');
  const textarea = document.getElementById('clipboardjs');

  // replicates the value of the textarea to a data-property to do some funky css auto-sizing of the textarea
  function updateSize() {
    textarea.parentNode.dataset.replicatedValue = textarea.value;
  }
  if(textarea) {
    textarea.addEventListener('input', updateSize);
    updateSize();
  }

  clipboard.on('success', function (e) {
    e.trigger.parentNode.classList.add('clipboard--copied');

    setTimeout(function () { // to repeat copied anim
      e.trigger.parentNode.classList.remove('clipboard--copied');
    }, 2000);
  });
};

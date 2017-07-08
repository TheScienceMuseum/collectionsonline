var Clipboard = require('clipboard');

module.exports = function () {
  // using bower / Clipboard for copying cite text. not really neceesary?
  // https://clipboardjs.com/
  var clipboard = new Clipboard('.clipboard__button');

  clipboard.on('success', function (e) {
    e.trigger.parentNode.classList.add('clipboard--copied');

    setTimeout(function () { // to repeat copied anim
      e.trigger.parentNode.classList.remove('clipboard--copied');
    }, 2000);
  });
};

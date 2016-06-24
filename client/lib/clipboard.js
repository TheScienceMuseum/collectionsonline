var Clipboard = require('clipboard');
var $ = require('jquery');

module.exports = function () {
  // using bower / Clipboard for copying cite text. not really neceesary?
  // https://clipboardjs.com/
  var clipboard = new Clipboard('.clipboard');

  clipboard.on('success', function (e) {
    // console.info('Action:', e.action);
    // console.info('Text:', e.text);
    // console.info('Trigger:', e.trigger);
    $(e.trigger).addClass('clipboard--copied');

    setTimeout(function () { // to repeat copied anim
      $(e.trigger).removeClass('clipboard--copied');
    }, 2000);
    // e.clearSelection();
  });
};

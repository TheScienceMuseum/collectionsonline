var $ = require('jquery');

module.exports = function () {
  // html5 details element needs a js polyfill, so sod it
  $(document).on('click', '.details__summary', function (e) {
    var $d = $(this).parent();
    $d.attr('aria-expanded', ($d.attr('aria-expanded') !== 'true'));
  });
};

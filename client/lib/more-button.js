var $ = require('jquery');

module.exports = function () {
  // html5 details element needs a js polyfill, so sod it
  $('.details__summary').on('click', function (e) {
    var $d = $(this).parent();
    $d.attr('aria-expanded', ($d.attr('aria-expanded') !== 'true'));
  });
};

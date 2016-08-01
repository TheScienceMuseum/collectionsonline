var $ = window.$ = window.jQuery = require('jquery');
require('slick-carousel');
var openseadragon = require('./openseadragon');

module.exports = function (ctx) {
  // main image carousel thing
  // http://kenwheeler.github.io/slick/
  $('.record-imgpanel__slick').slick({
    dots: true,
    appendDots: $('.record-imgpanel__slickthumbs'),
    dotsClass: 'record-imgpanel__thumbnav',
    customPaging: function (slider, i) {
      var thumb = $(slider.$slides[i]).data('thumb');
      return '<a><img src="' + thumb + '"></a>';
    },
    infinite: true,
    speed: 300,
    slidesToShow: 1,
    centerMode: true,
    variableWidth: true,
    nextArrow: '<button type="button" data-role="none" class="slick-next slick-arrow" aria-label="Next" role="button"><svg width="32" height="56" viewBox="0 0 32 56" xmlns="http://www.w3.org/2000/svg"><path d="M21.267 27.87L6.077 50.592l3.326 2.224L26.088 27.87 9.316 3 6 5.236" fill="#FFF" fill-rule="evenodd"/></svg></button>',
    prevArrow: '<button type="button" data-role="none" class="slick-prev slick-arrow" aria-label="Previous" role="button"><svg width="32" height="56" viewBox="0 0 32 56" xmlns="http://www.w3.org/2000/svg"><path d="M10.82 27.87l15.19 22.722-3.326 2.224L6 27.87 22.77 3l3.318 2.236" fill="#FFF" fill-rule="evenodd"/></svg></button>'
  });

  // make carousel as big as we have screen room for.
  $('.cite__expand').on('click', function () {
    // one of either imgpanel__singleimg or imgpanel__slick will exist, and they should work the same
    var $thingsWithH = $('.record-imgpanel__slick, .record-imgpanel__slick .pic, .record-imgpanel__singleimg, .record-imgpanel__singleimg .pic');

    var maxH = $(window).height() - $('.record-imgpanel').height() + $('.record-imgpanel__slick').height();
    var newPos = $('.record-imgpanel').offset().top;
    $('body').scrollTop(newPos);

    if ($('.record-imgpanel').hasClass('record-imgpanel--expanded')) {
      $thingsWithH.height('');
      $('.record-imgpanel').removeClass('record-imgpanel--expanded');
      $(this).removeClass('cite__expand--expanded');
    } else {
      $thingsWithH.height(maxH);
      $('.record-imgpanel').addClass('record-imgpanel--expanded');
      $(this).addClass('cite__expand--expanded');
    }

    if ($('.record-imgpanel__dragon').hasClass('hidden')) {
      $('.record-imgpanel__slickwrap').addClass('hidden');
      $('.record-imgpanel__dragon').removeClass('hidden');
      openseadragon($('.slick-active img')[0].src, ctx);
    } else {
      ctx.viewer.destroy();
      ctx.viewer = false;
      ctx.save();
      $('.record-imgpanel__slickwrap').removeClass('hidden');
      $('.record-imgpanel__dragon').addClass('hidden');
    }
  });

  $('.record-imgpanel__thumbnav a').on('click', function (e) {
    if (ctx.viewer) {
      ctx.viewer.destroy();
      ctx.save();
      openseadragon(e.target.src, ctx);
    }
  });
};

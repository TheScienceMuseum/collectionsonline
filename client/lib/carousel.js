/*eslint-disable no-unused-vars*/
var Carousel = require('carousel-js');

module.exports = () => {
  var carousel = new Carousel({
    panels: document.getElementsByClassName('carousel-image'),
    panelActiveClass: 'carousel-image-active',
    leftArrow: document.getElementById('left-button'),
    rightArrow: document.getElementById('right-button'),
    infinite: true
  });
};

module.exports = {
  'Carousel on image page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=camera')
      .waitForElementVisible('body', 1000)
      .click('.resultcard')
      .pause(2000)
      .url('http://localhost:8000/search?q=plumed-hat')
      .waitForElementVisible('body', 1000)
      .click('.resultcard')
      .pause(2000)
      .end();
  }
};

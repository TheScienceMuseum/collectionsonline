module.exports = {
  'Related Items': function (browser) {
    browser
      .url('http://localhost:8000/people/ap8')
      .waitForElementVisible('body', 1000)
      .click('.resultcard--seemore')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.resultcard', 'linkages')
      .url('http://localhost:8000/people/cp36993')
      .waitForElementVisible('body', 1000)
      .click('.resultcard--seemore')
      .assert.containsText('.resultcard', 'Babbage')
      .end();
  }
};

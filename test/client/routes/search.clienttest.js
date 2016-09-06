module.exports = {
  'Search Page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=charles%20babbage')
      .waitForElementVisible('body', 1000)
      .pause(2000)
      .assert.value('.searchbox__search', 'charles babbage')
      .assert.elementPresent('.resultcard')
      .assert.containsText('.resultcard', 'Charles Babbage')
      .end();
  }
};

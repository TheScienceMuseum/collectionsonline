module.exports = {
  'Search Page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=charles')
      .waitForElementVisible('body', 1000)
      .assert.value('.tt-input', 'charles')
      .assert.elementPresent('.resultcard')
      .end();
  }
};

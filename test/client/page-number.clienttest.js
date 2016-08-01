module.exports = {
  'Pagnination on one page result is not display': function (browser) {
    browser
      .url('http://localhost:8000/search?q=ada')
      .waitForElementVisible('body', 1000)
      .pause(1000)
      .assert.elementNotPresent('.pagination')
      .end();
  }
};

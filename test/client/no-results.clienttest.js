module.exports = {
  'Display list view on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=noooooooresults')
      .waitForElementVisible('body', 1000)
      .assert.elementNotPresent('.control__buttons')
      .assert.elementNotPresent('.control--filters')
      .end();
  }
};

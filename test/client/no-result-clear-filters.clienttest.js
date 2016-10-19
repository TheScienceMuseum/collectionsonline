module.exports = {
  'Display list view on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=ada&filter%5Bdate%5Bfrom%5D%5D=2000')
      .waitForElementVisible('body', 1000)
      .waitForElementVisible('.control--filters')
      .waitForElementVisible('.callout a', 1000)
      .end();
  }
};

module.exports = {
  'Display list view on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=ada')
      .waitForElementVisible('body', 1000)
      .click('#results-list')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search?q=ada&page[size]=50&page[type]=results-list')
      .end();
  }
};

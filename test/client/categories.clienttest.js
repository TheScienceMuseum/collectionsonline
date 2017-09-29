module.exports = {
  'Searching for categories adds filter': function (browser) {
    browser
      .url('http://localhost:8000/search?q=art')
      .waitForElementVisible('body', 1000)
      .assert.urlEquals('http://localhost:8000/search/categories/art')
      .click('a.filterbadge__x')
      .pause(2000)
      .setValue('input[type=search].searchbox__search', 'photographs')
      .click('button.searchbox__submit')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/categories/photographs')
      .url('http://localhost:8000/search?q=telecoms')
      .waitForElementVisible('body', 1000)
      .assert.urlEquals('http://localhost:8000/search/categories/telecommunications')
      .end();
  }
};

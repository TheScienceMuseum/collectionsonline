module.exports = {
  'Related Items': function (browser) {
    browser
      .url('http://localhost:8000/people/ap8')
      .waitForElementVisible('body', 1000)
      .click('.resultcard--seemore')
      .waitForElementVisible('body', 1000)
      // AdLib archives index makers as "Last, First" — the see-more link must
      // use that form, not the display title, or the search returns nothing.
      // Ranking changes over time, so assert on results rather than a title.
      .assert.urlContains('/search/documents/makers/babbage')
      .assert.elementPresent('.resultcard--documents')
      .url('http://localhost:8000/people/cp36993')
      .waitForElementVisible('body', 1000)
      .click('.resultcard--seemore')
      .assert.containsText('.resultcard', 'Babbage')
      .end();
  }
};

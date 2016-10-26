module.exports = {
  'People Page': function (browser) {
    browser
      .url('http://localhost:8000/people/cp36993')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Charles Babbage')
      .assert.containsText('.fact-occupation', 'Computer pioneer, Mathematician')
      .assert.containsText('.fact-Nationality', 'English')
      .assert.containsText('.fact-born-in', 'Southwark')
      .assert.containsText('.record-top__date', '1791 - 1871')
      .assert.containsText('.related-people > li > a', 'Lovelace')
      .url('http://localhost:8000/people/ap260')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Pease, John (1797-1868) Industrialist Quaker')
      .end();
  }
};

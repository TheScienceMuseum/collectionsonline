module.exports = {
  'People Page': function (browser) {
    browser
      .url('http://localhost:8000/people/smgc-people-36993')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Charles Babbage')
      .assert.containsText('.fact-occupation', 'Mathematician')
      .assert.containsText('.fact-Nationality', 'English')
      .assert.containsText('.fact-born-in', 'Southwark')
      .assert.containsText('.record-top__date', '1791 - 1871')
      .assert.containsText('.related-person > li > a', 'Lovelace')
      .assert.containsText('.related-person > li', 'association')
      .end();
  }
};

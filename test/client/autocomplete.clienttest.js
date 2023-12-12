module.exports = {
  'Should autocomplete words on home page': function (browser) {
    browser
      .url('http://localhost:8000/')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].searchbox__search', 'babb')
      // Wait for the suggestions menu to open
      .waitForElementVisible('.awesomplete li', 50000)
      // Assert that a suggestion is present, highlighting "Babb" of "Babbage"
      .assert.containsText('.awesomplete li', 'Babb')
      .end();
  },

  'Should not autocomplete words with < 3 letters on home page': function (browser) {
    browser
      .url('http://localhost:8000/')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].searchbox__search', 'ba')
      .pause(1000)
      // The suggestions menu should not show any suggestions
      .assert.elementNotPresent('.awesomplete li')
      .end();
  },

  'Should autocomplete words on search page': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .waitForElementVisible('input[type=search].searchbox__search', 1000)
      .setValue('input[type=search].searchbox__search', 'babb')
      // Wait for the suggestions menu to open
      .waitForElementVisible('.awesomplete li', 50000)
      // Assert that a suggestion is present, highlighting "Babb" of "Babbage"
      .assert.containsText('.awesomplete li', 'Babb')
      .end();
  },

  'Should not autocomplete words with < 3 letters on search page': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].searchbox__search', 'ba')
      .pause(1000)
      // The suggestions menu should not show any suggestions
      .assert.elementNotPresent('.awesomplete li')
      .end();
  }
};

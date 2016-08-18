module.exports = {
  'Should autocomplete words on home page': function (browser) {
    browser
      .url('http://localhost:8000/')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].searchbox__search.tt-input', 'babb')
      // Wait for the suggestions menu to open
      .waitForElementVisible('.tt-menu.tt-open', 1000)
      // ...and not empty
      .assert.elementNotPresent('.tt-menu.tt-empty')
      // Assert that a suggestion is present, highlighting "Babb" of "Babbage"
      .assert.containsText('.tt-highlight', 'Babb')
      .end();
  },

  'Should not autocomplete words with < 3 letters on home page': function (browser) {
    browser
      .url('http://localhost:8000/')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].searchbox__search.tt-input', 'ba')
      .pause(1000)
      // The suggestions menu should not show any suggestions
      .assert.elementPresent('.tt-menu.tt-empty')
      .end();
  },

  'Should autocomplete words on search page': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].searchbox__search.tt-input', 'babb')
      // Wait for the suggestions menu to open
      .waitForElementVisible('.tt-menu.tt-open', 1000)
      // ...and not empty
      .assert.elementNotPresent('.tt-menu.tt-empty')
      // Assert that a suggestion is present, highlighting "Babb" of "Babbage"
      .assert.containsText('.tt-highlight', 'Babb')
      .end();
  },

  'Should not autocomplete words with < 3 letters on search page': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].searchbox__search.tt-input', 'ba')
      .pause(1000)
      // The suggestions menu should not show any suggestions
      .assert.elementPresent('.tt-menu.tt-empty')
      .end();
  }
};

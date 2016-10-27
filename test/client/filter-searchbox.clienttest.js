module.exports = {
  'Search from home Page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=babbage')
      .waitForElementVisible('body', 1000)
      .pause(3000)
      .assert.elementNotPresent('.filter .filter--active .filter--uncollapsible')
      .waitForElementVisible('.filter[data-filter="Category"] a', 3000)
      .click('.filter[data-filter="Category"] a')
      .waitForElementVisible('.filter__box[value=Art]', 3000)
      .click('.filter__box[value=Art]')
      .waitForElementVisible('.filterbadge__label', 10000)
      .assert.containsText('.filterbadge__label', 'Art')
      .end();
  }
};

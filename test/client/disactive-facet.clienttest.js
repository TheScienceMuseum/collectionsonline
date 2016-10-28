module.exports = {
  'Disactive Facet': function (browser) {
    browser
      .url('http://localhost:8000/search/people?q=ada%20lovelace')
      .waitForElementVisible('body', 2000)
      .assert.elementNotPresent('.filter .filter--active .filter--uncollapsible')
      .waitForElementVisible('.filter[data-filter="Occupation"] a', 3000)
      .click('.filter[data-filter="Occupation"] a')
      .waitForElementVisible('.filter__box[value=mathematician]', 3000)
      .click('.filter__box[value=mathematician]')
      .waitForElementVisible('.filter--active', 3000)
      .click('.filter__box[value=mathematician]')
      .pause(3000)
      .assert.elementNotPresent('.filter .filter--active .filter--uncollapsible')
      .end();
  }
};

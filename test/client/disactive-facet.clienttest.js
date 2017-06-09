module.exports = {
  /* removed JU 09/06/2017 - need to add back
  'Disactive Facet': function (browser) {
    browser
      .url('http://localhost:8000/search/people?q=john')
      .waitForElementVisible('body', 2000)
      .assert.elementNotPresent('.filter .filter--active .filter--uncollapsible')
      .waitForElementVisible('.filter[data-filter="Occupation"] a', 3000)
      .click('.filter[data-filter="Occupation"] a')
      .waitForElementVisible('.filter__box[value=photographer]', 3000)
      .click('.filter__box[value=photographer]')
      .waitForElementVisible('.filter--active', 3000)
      .click('.filter__box[value=photographer]')
      .pause(3000)
      .assert.elementNotPresent('.filter .filter--active .filter--uncollapsible')
      .end();
  }
  */
};

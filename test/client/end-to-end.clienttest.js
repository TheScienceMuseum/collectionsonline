const config = require('../../config');

module.exports = {
  'Search from home Page': function (browser) {
    browser
      .url(config.rootUrl + '/')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].tt-input', 'ada')
      .click('button.searchbox__submit')
      .assert.urlEquals(config.rootUrl + '/search?q=ada')
      .click('.resultcard')
      .assert.urlEquals(config.rootUrl + '/people/smgc-people-38764')
      .waitForElementVisible('.record-top__title', 1000)
      .assert.containsText('.record-top__title', 'Lovelace')
      .end();
  }
};

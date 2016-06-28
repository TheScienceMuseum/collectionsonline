const config = require('../../../config');

module.exports = {
  'People Page': function (browser) {
    browser
      .url(config.rootUrl + '/people/smgc-people-36993')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Babbage')
      .assert.containsText('.fact-Occupation', 'mathematician')
      .assert.containsText('.fact-Nationality', 'English')
      .assert.containsText('.fact-Born', 'Southwark')
      .assert.containsText('.fact-Birth', '1791')
      .assert.containsText('.fact-Death', '1871')
      .end();
  }
};

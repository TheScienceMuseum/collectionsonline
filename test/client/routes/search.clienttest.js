const config = require('../../../config');

module.exports = {
  'Search Page': function (browser) {
    browser
      .url(config.rootUrl + '/search?q=charles')
      .waitForElementVisible('body', 1000)
      .assert.value('.tt-input', 'charles')
      .assert.elementPresent('.resultcard')
      .end();
  }
};

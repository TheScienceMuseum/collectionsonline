module.exports = {
/* commented out due to selenium issues / add back 16:9:2017 JU
  'next/back buttons': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .click('a[aria-label=Next]')
      .waitForElementVisible('a[aria-label=Previous]')
      .click('a[aria-label=Previous]')
      .assert.elementPresent('.resultcard')
      .end();
  }
*/
};

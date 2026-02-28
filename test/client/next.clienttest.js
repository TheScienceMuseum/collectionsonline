module.exports = {
  'next/back buttons': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .click('a.c-pagination__page--next')
      .waitForElementVisible('a.c-pagination__page--prev')
      .click('a.c-pagination__page--prev')
      .assert.elementPresent('.resultcard')
      .end();
  }
};

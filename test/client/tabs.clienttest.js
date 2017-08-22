module.exports = {
  'Check Tabs': function (browser) {
    browser
      .url('http://localhost:8000/search?q=pimple')
      .waitForElementVisible('body', 1000)
      .pause(1000)
      .assert.attributeEquals('.searchtab:nth-of-type(2)', 'aria-disabled', 'true')
      .assert.attributeContains('.searchtab:nth-of-type(4)', 'aria-disabled', 'true')
      .end();
  }
};

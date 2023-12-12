module.exports = {
  'Search from home Page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=book')
      .waitForElementVisible('body', 1000)
      .click('.resultcard')
      .waitForElementVisible('.searchbox__back', 1000)
      .assert.attributeEquals('.searchbox__back', 'href', 'http://localhost:8000/search?q=book')
      .pause(1000)
      .url('http://localhost:8000/objects/co62243')
      .waitForElementVisible('body', 1000)
      .waitForElementVisible('.searchbox__back', 1000)
      .assert.attributeEquals('.searchbox__back', 'href', 'http://localhost:8000/')
      .end();
  }
};

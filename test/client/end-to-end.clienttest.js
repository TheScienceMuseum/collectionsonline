module.exports = {
  'Search from home Page': function (browser) {
    browser
      .url('http://localhost:8000/')
      .waitForElementVisible('body', 1000)
      .setValue('input[type=search].tt-input', 'ada')
      .click('button.searchbox__submit')
      .assert.urlEquals('http://localhost:8000/search?q=ada')
      .click('.resultcard')
      .assert.urlEquals('http://localhost:8000/people/smgc-people-38764')
      .end();
  }
};

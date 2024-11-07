module.exports = {
  'check wikidata': function (browser) {
    browser
      .url('http://localhost:8000/people/cp50119/steve-jobs')
      .waitForElementVisible('body', 10000)
      .assert.elementPresent('#wikiInfo')
      .assert.containsText(
        'body',
        'chief executive officer, Pixar (1995 - 1997)'
      )
      .end();
  }
};

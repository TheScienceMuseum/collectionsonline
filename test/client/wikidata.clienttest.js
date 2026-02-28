module.exports = {
  '@retries': 0,
  'check wikidata': function (browser) {
    browser
      .url('http://localhost:8000/people/cp50119/steve-jobs')
      .waitForElementVisible('body', 10000)
      .assert.elementPresent('#wikiInfo')
      .waitForElementVisible('#wikiInfo h2', 20000)
      .assert.containsText(
        '#wikiInfo',
        'chief executive officer (1997-2011)'
      )
      .end();
  }
};

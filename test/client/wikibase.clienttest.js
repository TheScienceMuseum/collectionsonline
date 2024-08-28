module.exports = {
  'Wikibase connection': function (browser) {
    browser
      .url('http://localhost:8000/people/cp37054/albert-einstein')
      .waitForElementVisible('body', 10000)
      .getAttribute('.bleed', 'src', function (result) {
        const actualSrc = result.value;
        browser.assert.equal(
          actualSrc,
          'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Albert_Einstein_Head.jpg',
          'src attribute should match the expected URL'
        );
      })
      .end();
  }
};

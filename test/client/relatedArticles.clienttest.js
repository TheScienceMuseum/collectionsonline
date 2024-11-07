module.exports = {
  'check for related articles': function (browser) {
    browser
      .url(
        'http://localhost:8000/objects/co26704/rocket-locomotive-steam-locomotive'
      )
      .waitForElementVisible('body', 10000)
      .assert.elementPresent('#articles')
      .assert.containsText(
        '.related-article',
        'Travelling by train through time'
      )
      .click(
        'a[href="https://www.scienceandindustrymuseum.org.uk/objects-and-stories/travelling-by-train-through-time"]'
      )
      .assert.urlEquals(
        'https://www.scienceandindustrymuseum.org.uk/objects-and-stories/travelling-by-train-through-time'
      )
      .end();
  }
};

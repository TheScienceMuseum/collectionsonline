module.exports = {
  'Topics Page': function (browser) {
    browser
      .url('http://localhost:8000/group/c76602/1983-7572-parts')
      .waitForElementVisible('body', 1000)
      .assert.textContains(
        '.resultcard__title',
        'Grindstone from London, Brighton & South Coast Railway'
      )
      .click(
        'a[href="http://localhost:8000/objects/co221939/grindstone-from-london-brighton-south-coast-railway"]'
      )
      .pause(1000)
      .assert.urlEquals(
        'http://localhost:8000/objects/co221939/grindstone-from-london-brighton-south-coast-railway'
      )
      .pause(1000)
      .assert.textContains(
        '.record-top__title',
        'Grindstone from London, Brighton & South Coast Railway'
      )
      .end();
  }
};

module.exports = {
  'Document Page': function (browser) {
    browser
      .url('http://localhost:8000/documents/aa110000003')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'The Babbage Papers')
      .assert.containsText('.details-Identifier', 'BAB')
      .assert.containsText('.details-Access', 'The collection is available for public consultation')
      .assert.containsText('.details-copyright', 'Copies may be supplied')
      .assert.containsText('.details-System-of-Arrangement', 'Babbage’s work was divided into a series of distinct')
      .assert.containsText('.details-history-note', 'The archive was arranged and described by')
      .assert.containsText('.archive-tree', 'The Babbage Papers')
      .click('label[for=aa110000009]')
      .assert.urlEquals('http://localhost:8000/documents/aa110000003')
      .pause(1000)
      .assert.containsText('.archive-tree', 'cardboard model')
      .setValue('input[type=search]#archive-q', 'scheutz\'s')
      .click('.searchbox--archive button.searchbox__submit')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/documents?q=scheutz%27s&archive=The%20Babbage%20Papers')
      .assert.containsText('.resultcard', 'Papers relating to the Scheutz\'s Differenc...')
      .end();
  }
};

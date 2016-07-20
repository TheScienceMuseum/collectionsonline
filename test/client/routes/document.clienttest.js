module.exports = {
  'Document Page': function (browser) {
    browser
      .url('http://localhost:8000/documents/smga-documents-110000003')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'The Babbage Papers')
      .assert.containsText('.details-Identifier', 'BAB')
      .assert.containsText('.details-Access', 'The collection is available for public consultation')
      .assert.containsText('.details-rights', 'Copies may be supplied')
      .assert.containsText('.details-System-of-Arrangement', 'Babbage’s work was divided into a series of distinct')
      .assert.containsText('.details-history-note', 'The archive was arranged and described by')
      .assert.containsText('.archive-tree', 'The Babbage Papers')
      .click('button[value=smga-documents-110000036]')
      .assert.urlEquals('http://localhost:8000/documents/smga-documents-110000003?expanded=smga-documents-110000036#archive-block')
      .assert.containsText('.archive-tree', 'Part of the end view of the Difference Engine')
      .end();
  }
};

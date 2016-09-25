module.exports = {
  'Object Page': function (browser) {
    browser
      .url('http://localhost:8000/objects/smgc-objects-26704')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Rocket')
      .assert.containsText('.fact-maker', 'Robert Stephenson and Company')
      .assert.containsText('.fact-designer', 'Stephenson')
      .assert.containsText('.fact-Made', 'Newcastle')
      .assert.containsText('.details-Category', 'Locomotives and Rolling Stock')
      .assert.containsText('.details-Accession-Number', '1862-5')
      .assert.containsText('.details-status', 'permanent collection')
      .assert.containsText('.details-credit', 'Thompson and Sons')
      .assert.containsText('.details-type', 'steam locomotive')
      .assert.containsText('.details-Materials', 'brass (copper, zinc alloy), iron, pine (wood), steel (metal)')
      .end();
  }
};

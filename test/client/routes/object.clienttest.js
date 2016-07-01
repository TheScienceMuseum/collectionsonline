module.exports = {
  'Object Page': function (browser) {
    browser
      .url('http://localhost:8000/objects/smgc-objects-205752')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Duchess')
      .assert.containsText('.fact-maker', 'London, Midland & Scottish')
      .assert.containsText('.fact-designer', 'Stanier')
      .assert.containsText('.fact-Made', 'Crewe')
      .assert.containsText('.details-Category', 'Locomotives')
      .assert.containsText('.details-Accession-Number', '1976-7000')
      .assert.containsText('.details-Measurements', '22511 mm')
      .assert.containsText('.details-status', 'permanent collection')
      .assert.containsText('.details-credit', 'Butlins')
      .assert.containsText('.details-type', 'steam locomotive')
      .assert.containsText('.details-taxonomy', 'Locomotive and Rolling Stock, steam, steam locomotive')
      .end();
  }
};

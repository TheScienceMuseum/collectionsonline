module.exports = {
  'Object Page': function (browser) {
    browser
      .url('http://localhost:8000/objects/smgc-objects-8245103')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Amerscan')
      .assert.containsText('.fact-Maker', 'Amersham')
      .assert.containsText('.fact-Made', 'Chalfont')
      .assert.containsText('.details-Category', 'Nuclear')
      .assert.containsText('.details-Accession-Number', '1982-1705/2')
      .assert.containsText('.details-Materials', 'cardboard')
      .assert.containsText('.details-Measurements', '100 mm')
      .assert.containsText('.details-Status', 'permanent collection')
      .end();
  }
};

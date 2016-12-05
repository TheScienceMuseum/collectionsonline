module.exports = {
  'Object Page': function (browser) {
    browser
      .url('http://localhost:8000/objects/co26704')
      .waitForElementVisible('body', 1000)
      .assert.containsText('.record-top__title', 'Rocket')
      .assert.containsText('.fact-maker', 'Robert Stephenson and Company')
      .assert.containsText('.fact-designer', 'Stephenson')
      .assert.containsText('.fact-Made', 'Newcastle')
      .assert.containsText('.details-Category', 'Locomotives and Rolling Stock')
      .assert.containsText('.details-Object-Number', '1862-5')
      .assert.containsText('.details-status', 'Permanent collection')
      .assert.containsText('.details-credit', 'Thompson and Sons')
      .assert.containsText('.details-type', 'steam locomotive')
      .end();
  }
};

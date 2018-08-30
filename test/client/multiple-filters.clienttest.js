/*
module.exports = {
  'Selecting multiple filters on search page': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .waitForElementVisible('.filter[data-filter="Type"] a', 5000)
      .click('.filter[data-filter="Type"] a')
      .waitForElementVisible('.filter__box[value="bottles"]', 5000)
      .click('.filter__box[value="bottles"]')
      .pause(2000)
      .assert.urlEquals('http://localhost:8000/search/object_type/bottles')
      .waitForElementVisible('.filter__box[value="tablets"]', 5000)
      .click('.filter__box[value="tablets"]')
      .pause(2000)
      .assert.urlEquals('http://localhost:8000/search/object_type/bottles+tablets')
      .waitForElementVisible('.resultcard__title', 5000)
      .assert.containsText('.resultcard__title', 'tablets')
      .assert.containsText('.resultcard__title', 'Bottle of "Drazine" tablets, with instructions, in')
      .end();
  }
};
*/

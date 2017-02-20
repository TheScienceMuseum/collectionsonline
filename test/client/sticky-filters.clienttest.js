module.exports = {
  'Sticky filters persist after new search': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .waitForElementVisible('.filter[data-filter="Museum"] a', 1000)
      .click('.filter[data-filter="Museum"] a')
      .waitForElementVisible('.filter__box[value="Great Hall"]', 1000)
      .click('.filter__box[value="Great Hall"]')
      .pause(1500)
      .assert.urlEquals('http://localhost:8000/search/museum/National%20Railway%20Museum/gallery/Great%20Hall?page[size]=50')
      .setValue('input[type=search].searchbox__search', 'electric')
      .click('button.searchbox__submit')
      .assert.urlEquals('http://localhost:8000/search/museum/National%20Railway%20Museum/gallery/Great%20Hall?q=electric')
      .end();
  }
};

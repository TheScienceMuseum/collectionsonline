module.exports = {
  'Filtering on search page by date': function (browser) {
    browser
    .url('http://localhost:8000/search/people?q=ada')
    .waitForElementVisible('body', 1000)
    .pause(5000)
    .waitForElementVisible('.filter[data-filter="Dates"] a', 20000)
    .click('.filter[data-filter="Dates"] a')
    .setValue('input[name="date[from]"]', '1700')
    .click('input[name="date[to]"]')
    .pause(10000)
    .assert.urlEquals('http://localhost:8000/search/people/date[from]/1700?q=ada&page[size]=50')
    .end();
  }
};

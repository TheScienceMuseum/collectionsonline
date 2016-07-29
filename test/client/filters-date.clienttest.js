module.exports = {
  'Filtering on search page by date': function (browser) {
    browser
    .url('http://localhost:8000/search/people?q=ada')
    .waitForElementVisible('body', 1000)
    .click('#fb')
    .setValue('input[name="filter[birth[date]]"]', '1700')
    .click('input[name="filter[death[date]]"]')
    .pause(1000)
    .assert.urlEquals('http://localhost:8000/search/people?q=ada&filter%5Bbirth%5Bdate%5D%5D=1700&page%5Bsize%5D=50')
    .end();
  }
};

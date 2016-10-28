module.exports = {
  'Selecting multiple filters on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=engine')
      .waitForElementVisible('body', 1000)
      .pause(5000)
      .waitForElementVisible('.filter[data-filter="Type"] a', 1000)
      .click('.filter[data-filter="Type"] a')
      .waitForElementVisible('.filter__box[value="petrol engines"]', 5000)
      .click('.filter__box[value="petrol engines"]')
      .pause(10000)
      .assert.urlEquals('http://localhost:8000/search?q=engine&filter%5Btype%5D=petrol%20engines&page%5Bsize%5D=50&page%5Btype%5D=search')
      .assert.containsText('.searchtab:nth-of-type(1)', '25')
      .assert.containsText('.searchtab:nth-of-type(2)', '0')
      .assert.containsText('.searchtab:nth-of-type(3)', '25')
      .assert.containsText('.searchtab:nth-of-type(4)', '0')
      .click('.filter__box[value="private car components"]')
      .pause(10000)
      .assert.urlEquals('http://localhost:8000/search?q=engine&filter%5Btype%5D=petrol%20engines&filter%5Btype%5D=private%20car%20components&page%5Bsize%5D=50&page%5Btype%5D=search')
      .assert.containsText('.searchtab:nth-of-type(1)', '7')
      .assert.containsText('.searchtab:nth-of-type(2)', '0')
      .assert.containsText('.searchtab:nth-of-type(3)', '7')
      .assert.containsText('.searchtab:nth-of-type(4)', '0')
      .click('.searchtab:nth-of-type(3)')
      .pause(10000)
      .assert.urlEquals('http://localhost:8000/search/objects?q=engine&filter%5Btype%5D=petrol%20engines&filter%5Btype%5D=private%20car%20components&page%5Bsize%5D=50&page%5Btype%5D=search')
      .assert.containsText('.searchtab:nth-of-type(1)', '7')
      .assert.containsText('.searchtab:nth-of-type(2)', '0')
      .assert.containsText('.searchtab:nth-of-type(3)', '7')
      .assert.containsText('.searchtab:nth-of-type(4)', '0')
      .end();
  }
};

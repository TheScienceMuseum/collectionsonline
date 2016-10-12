module.exports = {
  'Selecting multiple filters on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=engine')
      .waitForElementVisible('body', 1000)
      .pause(1000)
      .waitForElementVisible('.filter[data-filter="Type"] a', 1000)
      .click('.filter[data-filter="Type"] a')
      .waitForElementVisible('.filter__box[value="Petrol engines"]', 5000)
      .click('.filter__box[value="Petrol engines"]')
      .pause(5000)
      .assert.urlEquals('http://localhost:8000/search?q=engine&filter%5Btype%5D=Petrol%20engines&page%5Bsize%5D=50&page%5Btype%5D=search')
      .assert.containsText('.searchtab:nth-of-type(1)', '58')
      .assert.containsText('.searchtab:nth-of-type(2)', '0')
      .assert.containsText('.searchtab:nth-of-type(3)', '58')
      .assert.containsText('.searchtab:nth-of-type(4)', '0')
      .click('.filter__box[value=Clutches]')
      .pause(4000)
      .assert.urlEquals('http://localhost:8000/search?q=engine&filter%5Btype%5D=Petrol%20engines&filter%5Btype%5D=Clutches&page%5Bsize%5D=50&page%5Btype%5D=search')
      .assert.containsText('.searchtab:nth-of-type(1)', '7')
      .assert.containsText('.searchtab:nth-of-type(2)', '0')
      .assert.containsText('.searchtab:nth-of-type(3)', '7')
      .assert.containsText('.searchtab:nth-of-type(4)', '0')
      .click('.searchtab:nth-of-type(3)')
      .pause(4000)
      .assert.urlEquals('http://localhost:8000/search/objects?q=engine&filter%5Btype%5D=Petrol%20engines&filter%5Btype%5D=Clutches&page%5Bsize%5D=50&page%5Btype%5D=search')
      .assert.containsText('.searchtab:nth-of-type(1)', '7')
      .assert.containsText('.searchtab:nth-of-type(2)', '0')
      .assert.containsText('.searchtab:nth-of-type(3)', '7')
      .assert.containsText('.searchtab:nth-of-type(4)', '0')
      .end();
  }
};

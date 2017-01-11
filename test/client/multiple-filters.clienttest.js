module.exports = {
  'Selecting multiple filters on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=engine')
      .waitForElementVisible('body', 1000)
      .pause(5000)
      .waitForElementVisible('.filter[data-filter="Type"] a', 1000)
      .click('.filter[data-filter="Type"] a')
      .waitForElementVisible('.filter__box[value="aircraft engine"]', 5000)
      .click('.filter__box[value="aircraft engine"]')
      .pause(2000)
      .assert.urlEquals('http://localhost:8000/search?q=engine&filter%5Btype%5D=aircraft%20engine&page%5Bsize%5D=50&page%5Btype%5D=search')
      // removed JU (11/02/2017) - need to add back
      // .assert.containsText('.searchtab:nth-of-type(1)', '29')
      // .assert.containsText('.searchtab:nth-of-type(2)', '0')
      // .assert.containsText('.searchtab:nth-of-type(3)', '29')
      // .assert.containsText('.searchtab:nth-of-type(4)', '0')
      // .click('.filter__box[value="supercharger"]')
      // .pause(2000)
      // .assert.urlEquals('http://localhost:8000/search?q=engine&filter%5Btype%5D=aircraft%20engine&filter%5Btype%5D=supercharger&page%5Bsize%5D=50&page%5Btype%5D=search')
      // .assert.containsText('.searchtab:nth-of-type(1)', '1')
      // .assert.containsText('.searchtab:nth-of-type(2)', '0')
      // .assert.containsText('.searchtab:nth-of-type(3)', '1')
      // .assert.containsText('.searchtab:nth-of-type(4)', '0')
      // .click('.searchtab:nth-of-type(3)')
      // .pause(2000)
      // .assert.urlEquals('http://localhost:8000/search/objects?q=engine&filter%5Btype%5D=aircraft%20engine&filter%5Btype%5D=supercharger&page%5Bsize%5D=50&page%5Btype%5D=search')
      // .assert.containsText('.searchtab:nth-of-type(1)', '1')
      // .assert.containsText('.searchtab:nth-of-type(2)', '0')
      // .assert.containsText('.searchtab:nth-of-type(3)', '1')
      // .assert.containsText('.searchtab:nth-of-type(4)', '0')
      .end();
  }
};

module.exports = {
  'Filtering on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=charles')
      .waitForElementVisible('body', 1000)
      .click('.searchtab:nth-of-type(2)')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .click('.filter[data-filter=Occupation] > a')
      .pause(1000)
      .waitForElementVisible('.filter__box[value=artist]', 3000)
      .click('.filter__box[value=artist]')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people/occupation/artist?q=charles')
      .assert.containsText('.resultcard', '1873-1928, artist; painter; poster artist, British')
      .click('.filter__box')
      .pause(3000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .assert.containsText('.resultcard', '1600-1649, reigned 1625-1649, king of England, Scotland, and Ireland')
      .pause(1000)
      .click('.filter__box[value=inventor]')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people/occupation/inventor?q=charles')
      .click('.filter__box[value=inventor]')
      .pause(1000)
      .click('.filter__box[value="England, United Kingdom"]')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .click('.filter__box[value="England, United Kingdom"]')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .end();
  }
};

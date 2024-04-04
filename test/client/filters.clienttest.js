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
      .click('.filter__box[value=painter]')
      .pause(1000)
      .assert.urlEquals(
        'http://localhost:8000/search/people/occupation/artist+painter?q=charles'
      )
      .assert.containsText(
        '.resultcard',
        '1875-1961, artist; painter; poster artist, British'
      )
      .click('.filter__box')
      .pause(1000)
      .click('.filter__box[value=painter]')
      .pause(6000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .assert.containsText(
        '.resultcard',
        '1806-1872, author, physician, Ireland'
      )
      .pause(1000)
      .click('.filter__box[value=inventor]')
      .pause(1000)
      .assert.urlEquals(
        'http://localhost:8000/search/people/occupation/inventor?q=charles'
      )
      .click('.filter__box[value=inventor]')
      .pause(1000)
      .click('.filter[data-filter="Place born"] > a')
      .pause(1000)
      .click('.filter__box[value="England, United Kingdom"]')
      .pause(1000)
      .assert.urlEquals(
        'http://localhost:8000/search/people/birth[place]/england,-united-kingdom?q=charles'
      )
      .click('.filter__box[value="England, United Kingdom"]')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .end();
  }
};

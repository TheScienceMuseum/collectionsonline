module.exports = {
  'Selecting multiple filters on search page': function (browser) {
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('body', 1000)
      .waitForElementVisible('.filter[data-filter="Type"] a', 5000)
      .click('.filter[data-filter="Type"] a')
      .waitForElementVisible('.filter__box[value="poster"]', 5000)
      .click('.filter__box[value="poster"]')
      .pause(2000)
      .assert.urlEquals('http://localhost:8000/search/object_type/poster')
      .waitForElementVisible('.filter__box[value="film poster"]', 5000)
      .click('.filter__box[value="film poster"]')
      .pause(8000)
      .assert.urlEquals(
        'http://localhost:8000/search/object_type/poster+film-poster'
      )
      .waitForElementVisible('.resultcard__title', 5000)
      .assert.containsText('.resultcard__title', 'Poster')
      .assert.containsText(
        '.resultcard__title',
        'Poster for the film \'Daag\''
      )
      .end();
  }
};

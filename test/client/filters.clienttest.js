module.exports = {
  'Filtering on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=charles')
      .waitForElementVisible('body', 1000)
      .click('.searchtab:nth-of-type(2)')
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .pause(1000)
      .click('button.control__button')
      .waitForElementVisible('.filter__box', 3000)
      .click('.filter__box')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles&filter[occupation]=artist')
      .assert.containsText('.resultcard', 'Charles Dixon')
      .click('.filter__box')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles')
      .assert.containsText('.resultcard', 'prince')
      .click('button.control__button')
      .pause(1000)
      .click('.filter__box')
      .pause(1000)
      .click('.filter__box[value=inventor]')
      .pause(1000)
      .assert.urlEquals('http://localhost:8000/search/people?q=charles&filter[occupation]=artist&filter[occupation]=inventor')
      .end();
  }
};

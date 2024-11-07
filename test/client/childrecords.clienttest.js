module.exports = {
  'Mphc Object record page, see more btn and search page': function (browser) {
    browser
      .url(
        'http://localhost:8000/objects/co8413731/collection-of-objects-and-archives-from-boddingtons-brewery-at-strangeways-collection-of-objects-and-archives'
      )
      .waitForElementVisible('body', 1000)
      .assert.elementPresent('.mph-records__grid')
      .assert.textContains(
        '.resultcard__title',
        'Wooden Sign, Strangeways Brewery'
      )
      .assert.elementPresent('.mph-records__grid')
      .assert.textContains('body', 'See more')
      .click('a[href="/search/objects/mphc/co8413731"]')
      .assert.urlEquals('http://localhost:8000/search/objects/mphc/co8413731')
      .pause(1000)
      .assert.textContains(
        '.description-box',
        'Collection of objects and archives from Boddingtons Brewery at Strangeways'
      )
      .end();
  },

  'sph record child priority cards + child record nesting': function (browser) {
    browser
      .url('http://localhost:8000/objects/co8399644/stewart-albums')
      .waitForElementVisible('body', 10000)
      .assert.elementPresent('.sph-priority-item')
      .assert.textContains(
        '.resultcard__title',
        'Snapshot photograph album no. 1 of the Russian Imperial Royal Family'
      )
      .assert.textContains(
        'body',
        'Page 1 from snapshot photograph album no. 1'
      )
      .assert.textContains('body', 'View from my window at Gatchina')
      .end();
  }
};

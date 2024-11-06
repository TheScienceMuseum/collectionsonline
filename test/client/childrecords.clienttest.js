// checks for see more/pillbox, different hierarchies, etc

module.exports = {
  'Mphc Object record page and see more btn': function (browser) {
    browser
      .url(
        'http://localhost:8000/objects/co8413731/collection-of-objects-and-archives-from-boddingtons-brewery-at-strangeways-collection-of-objects-and-archives'
      )
      .waitForElementVisible('body', 1000)
      .assert.elementPresent('.mph-records__grid')
      .assert.containsText(
        '.resultcard__title',
        'Wooden Sign, Strangeways Brewery'
      )
      .assert.elementPresent('.mph-records__grid')
      .assert.containsText('.resultcard__title', 'See more')
      .click('a[href="http://localhost:8000//search/objects/mphc/co8413731"]')
      .assert.urlEquals('http://localhost:8000/search/objects/mphc/co8413731')
      .pause(1000)
      .assert.containsText(
        '.description-box',
        'Collection of objects and archives from Boddingtons Brewery at Strangeways'
      )
      .assert.containsText('.resultcard__title', ' Blouse, gold')
      .end();
  }
};

// module.exports = {
//   'sph priority cards + child record nesting': function (browser) {
//     browser
//       .url('http://localhost:8000/objects/co8399644/stewart-albums')
//       .waitForElementVisible('body', 1000)
//       .assert.elementPresent('.sph-priority-item')
//         .assert.containsText('.resultcard__title', 'Snapshot photograph album no. 1 of the Russian Imperial Royal Family')
//       .assert.containsText('.resultcard__title', 'Page 1 from snapshot photograph album no. 1')
//       .assert.containsText('.resultcard__title', 'View from my window at Gatchina')
//       .end();
//   },
// };

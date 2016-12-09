module.exports = {
  'Using Rest Style Urls': function (browser) {
    browser
    .url('http://localhost:8000/search/objects/categories/art')
    .waitForElementVisible('body', 1000)
    .waitForElementVisible('.resultcard', 1000)
    .assert.containsText('.filterbadge[data-filter="Category"]', 'Art', 1000)
    .assert.urlEquals('http://localhost:8000/search/objects?categories=Art')
    .url('http://localhost:8000/search/objects/museum/scm')
    .waitForElementVisible('body', 1000)
    .waitForElementVisible('.resultcard', 1000)
    .assert.containsText('.filterbadge[data-filter="Museum"]', 'Science Museum', 1000)
    .assert.urlEquals('http://localhost:8000/search/objects?museum=Science%20Museum')
    .url('http://localhost:8000/search/gallery/Great%20Hall')
    .waitForElementVisible('body', 1000)
    .waitForElementVisible('.resultcard', 1000)
    .assert.containsText('.filterbadge[data-filter="Museum"]', 'National Railway Museum - Great Hall', 1000)
    .assert.urlEquals('http://localhost:8000/search?gallery=Great%20Hall')
    .end();
  }
};

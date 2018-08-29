module.exports = {
  'Check Title pages': function (browser) {
    browser
      .url('http://localhost:8000/search?q=ada')
      .waitForElementVisible('body', 1000)
      .pause(1000)
      .assert.title('Search our collection | Science Museum Group Collection')
      .url('http://localhost:8000')
      .waitForElementVisible('body', 1000)
      .pause(1000)
      .assert.title('Science Museum Group Collection')
      .url('http://localhost:8000/people/cp38764')
      .waitForElementVisible('body', 1000)
      .pause(1000)
      .assert.title('Ada Lovelace | Science Museum Group Collection')
      .url('http://localhost:8000/search/museum/science-museum/gallery/information-age-gallery:-cable?page[size]=50')
      .waitForElementVisible('body', 1000)
      .pause(1000)
      .assert.title('On display at the Science Museum : Information Age Gallery: Cable | Science Museum Group Collection')
      .end();
  }
};

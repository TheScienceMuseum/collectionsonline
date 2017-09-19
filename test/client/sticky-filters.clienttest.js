module.exports = {
/* commented out due to selenium issues / add back 16:9:2017 JU
    browser
      .url('http://localhost:8000/search')
      .waitForElementVisible('.filter[data-filter="Museum"] a', 5000)
      .click('.filter[data-filter="Museum"] a')
      .waitForElementVisible('.filter__box[value="Great Hall"]', 5000)
      .click('.filter__box[value="Great Hall"]')
      .pause(3000)
      .assert.urlEquals('http://localhost:8000/search/museum/national-railway-museum/gallery/great-hall')
      .setValue('input[type=search].searchbox__search', 'electric')
      .click('button.searchbox__submit')
      .pause(3000)
      .assert.urlEquals('http://localhost:8000/search/museum/national-railway-museum/gallery/great-hall?q=electric')
      .end();
  }
*/
};

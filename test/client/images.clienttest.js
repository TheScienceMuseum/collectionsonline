module.exports = {
  'Filtering on search page': function (browser) {
    browser
      .url('http://localhost:8000/search?q=rocket')
      .waitForElementVisible('body', 1000)
      .waitForElementVisible('.resultcard__figure', 1000)
      .assert.attributeEquals('.resultcard__figure img', 'src', 'http://smgco-images.s3.amazonaws.com/media/236/214/large_thumbnail_1949_0049_0003__0001_.jpg')
      .url('http://localhost:8000/search?q=calculating-machine')
      .click('.searchtab:nth-of-type(4)')
      .pause(2000)
      .waitForElementVisible('.resultcard__figure', 1000)
      .assert.attributeEquals('.resultcard__figure img', 'src', 'http://smgco-images.s3.amazonaws.com/media/222/272/large_thumbnail_BAB_K_62_Calculating_Machine.jpg')
      .end();
  }
};

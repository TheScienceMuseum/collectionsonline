// module.exports = {
//   'Filtering on search page': function (browser) {
//     browser
//       .url('http://localhost:8000/search?q=rocket')
//       .waitForElementVisible('body', 1000)
//       .waitForElementVisible('.resultcard__figure', 1000)
//       .assert.attributeEquals('.resultcard__figure img', 'src', 'http://smgco-images.s3.amazonaws.com/media/Photo_Studio/Archive/Inventory_Number/1860/1862/1862_0005__0001__tif/mid_1862_0005__0001_.jpg')
//       .url('http://localhost:8000/search?q=calculating%20machine')
//       .click('.searchtab:nth-of-type(4)')
//       .pause(2000)
//       .waitForElementVisible('.resultcard__figure', 1000)
//       .assert.attributeEquals('.resultcard__figure img', 'src', 'http://smgco-images.s3.amazonaws.com/media/Archive_6/jDMwMTTlK9AAAAFSfdzWcg_WINID_1453810572897/BAB_K_62v_Calculating_Machine_tif/mid_BAB_K_62v_Calculating_Machine.jpg')
//       .end();
//   }
// };

// module.exports = {
//   'Related Items': function (browser) {
//     browser
//       .url('http://localhost:8000/people/ap8')
//       .waitForElementVisible('body', 1000)
//       .click('.resultcard--seemore')
//       .waitForElementVisible('body', 1000)
//       .assert.containsText('.resultcard', 'Babbage')
//       .url('http://localhost:8000/people/cp20600')
//       .waitForElementVisible('body', 1000)
//       .click('.resultcard--seemore')
//       .assert.containsText('.resultcard', 'Apple')
//       .end();
//   }
// };

const test = require('tape');
const validate = require('../auth/validate');
const config = require('../config');

test('Should check correctly', (t) => {
  const user = config.user;
  const password = config.password;
  config.user = 'testUser';
  config.password = 'securePassword';
  const resultTrue = validate('testUser', 'securePassword');
  const resultFalse = validate('wrongUser', 'wrongPassword');
  t.plan(2);
  t.equal(resultTrue, true, 'validate the correct user');
  t.equal(resultFalse, false, 'Block wrong user');
  config.user = user;
  config.password = password;
  t.end();
});

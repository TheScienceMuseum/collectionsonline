const config = require('../config');
module.exports = function (username, password) {
  if (config.user === username && config.password === password) {
    return true;
  } else {
    return false;
  }
};

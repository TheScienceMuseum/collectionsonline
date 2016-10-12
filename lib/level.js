const levelup = require('level-party');
const level = levelup('./counts');

module.exports = level;

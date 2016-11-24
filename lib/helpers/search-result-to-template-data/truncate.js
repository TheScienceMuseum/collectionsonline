'use strict';

/**
* Truncate the name of the museum and galleries
*/

module.exports = function (ondisplay, maxChar) {
  return ondisplay.length <= maxChar
    ? ondisplay
    : ondisplay.slice(0, maxChar) + '...';
};

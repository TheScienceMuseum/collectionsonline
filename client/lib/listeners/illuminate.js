/*
  'illuminate' is the SMG brand term for using a range of font-weights across text.
  Only to be used on special occasions.
  Note this implementation doesn't check for possible text wrap.
  If the string doesn't divide equally, we spread the modulos from the heavier end
*/
module.exports = () => {
  /**
   * Array of `font-weight`s to use, in the order we want them.
   see ../src/scss/settings/_type.scss
   */
  var weights = [900, 700, 500, 400, 300, 100];

  function chunkString (string) {
    var chunkLength = Math.floor(string.length / weights.length);
    var modulo = string.length % weights.length;
    var chunks = [];
    var strStart = 0;
    for (var i = 0; i < weights.length; i++) {
      var strEnd = chunkLength;
      if (modulo > 0) {
        strEnd += 1;
      }
      chunks[i] = string.substr(strStart, strEnd);
      modulo -= 1;
      strStart = strStart + strEnd;
    }
    return chunks;
  }

  function addWrappers (element) {
    var chunkedString = chunkString(element.innerHTML);
    var spanified = [];
    for (var i = 0; i < chunkedString.length; i++) {
      spanified[i] =
        '<span aria-hidden="true" style="font-weight: ' +
        weights[i] +
        ';">' +
        chunkedString[i] +
        '</span>';
    }
    return spanified.join('');
  }

  function renderStrings (elements) {
    for (var i = 0; i < elements.length; i++) {
      // Add aria-label to maintain voice-readability of original
      elements[i].setAttribute('aria-label', elements[i].innerHTML);
      // Replace old string with gradientised one
      elements[i].innerHTML = addWrappers(elements[i]);
    }
  }

  var strings = document.querySelectorAll('.js-illuminate');
  renderStrings(strings);
};

// Vendored from smg-web-design-system@0.11.8
// Source: src/js/components/illuminate.js
// https://github.com/TheScienceMuseum/web-design-system/tree/0.11.8/src/js/components/illuminate.js
// Date vendored: 2026-10-09
// Reason: the dep ships no dist/ on GitHub-source install, and transpiling its
// ES-module source through babelify + browserify is fragile (see PR). Resync by
// hand if the smg-web-design-system pin is bumped — this file is a verbatim
// copy of the source above with `export default function X()` rewritten as
// `module.exports = function X()`.

/*
  'illuminate' is the SMG brand guidelines term for using a range of font-weights across text.
  Only to be used on special occasions.

*/

module.exports = function illuminate (options) {
  options = options || {};
  var selector = options.selector || ".js-illuminate";
  var debug = options.debug || false;
  var log = {};

  /**
   * Array of `font-weight`s to use, in the order we want them.
   see ../src/scss/settings/_type.scss
   */
  var weights = [900, 700, 500, 400, 300, 100];

  function chunkString(string) {
    var chunkLength = Math.floor(string.length / weights.length);
    // If the string doesn't divide equally, we spread the modulos from the heavier end
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

  function addWeightWrappers(textString) {
    var chunkedString = chunkString(textString);
    var spanified = [];
    for (var i = 0; i < chunkedString.length; i++) {
      spanified[i] =
        '<span aria-hidden="true" style="font-weight: ' +
        weights[i] +
        ';">' +
        chunkedString[i] +
        "</span>";
    }
    return spanified.join("");
  }

  function wrapLines(element) {
    var string = element.getAttribute("aria-label");
    var text = string.split("");

    // get all the current line-break points.
    // if the height of the el increases when we add a character, then we haz wrap. BUT that's not necessarily the break point. Generally, browsers will break at word boundary, so we reverse to the previous space. Though other characters or space constraints could cause different breaks?

    element.innerHTML = "";
    var span = document.createElement("span");
    element.appendChild(span);
    var spanHeight = 0;
    var splitPoints = [];
    var lastBreak = 0;
    for (var i = 0; i < text.length; i++) {
      span.innerHTML = span.innerHTML + text[i];
      if (text[i] == " ") lastBreak = i;
      if (span.offsetHeight > spanHeight) {
        spanHeight = span.offsetHeight;
        splitPoints.push(lastBreak);
      }
      if (text[i].match(/\n/)) {
        // add exceptions, such as line break characters.
        splitPoints.push(i);
      }
      log.heights = {};
      log.heights[i] = span.offsetHeight;
    }
    splitPoints.push(text.length);
    // sort and remove duplicates, just in case
    splitPoints.sort((a, b) => a - b);
    splitPoints = splitPoints.reduce(
      (x, y) => (x.includes(y) ? x : [...x, y]),
      []
    );
    log.splitPoints = splitPoints;

    var lines = splitPoints.reduce((accumulator, currentValue, i) => {
      if (i + 1 < splitPoints.length) {
        accumulator.push(string.slice(splitPoints[i], splitPoints[i + 1]));
      }

      return accumulator;
    }, []);

    element.innerHTML = "";
    for (var i = 0; i < lines.length; i++) {
      var span = document.createElement("span");
      span.className = "line";
      span.innerHTML = addWeightWrappers(lines[i]);
      element.appendChild(span);
      if (i < lines.length - 1) {
        element.appendChild(document.createElement("br"));
      }
    }

    return element.innerHTML;
  }

  function renderStrings(elements) {
    for (var i = 0; i < elements.length; i++) {
      // Add aria-label to maintain voice-readability of original, and use as reference text for remeasuring.
      if (!elements[i].getAttribute("aria-label"))
        elements[i].setAttribute("aria-label", elements[i].innerText);

      elements[i].innerHTML = wrapLines(elements[i]);
    }
  }

  // go, and go again on resize.
  function initialise() {
    var strings = document.querySelectorAll(selector);
    renderStrings(strings);
    if (debug) {
      console.log(log);
    }
  }
  initialise();
  window.addEventListener("resize", initialise);
};

function promisePolyfill () {
  if (!window.Promise) {
    window.Promise = require('promise');
  }
}

// Polyfills from MDN - https://developer.mozilla.org
function removePolyfill () {
  if (!('remove' in Element.prototype)) {
    Element.prototype.remove = function () {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    };
  }
}

function findPolyfill () {
  if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
      value: function(predicate) {
       'use strict';
       if (this == null) {
         throw new TypeError('Array.prototype.find called on null or undefined');
       }
       if (typeof predicate !== 'function') {
         throw new TypeError('predicate must be a function');
       }
       var list = Object(this);
       var length = list.length >>> 0;
       var thisArg = arguments[1];
       var value;

       for (var i = 0; i < length; i++) {
         value = list[i];
         if (predicate.call(thisArg, value, i, list)) {
           return value;
         }
       }
       return undefined;
      }
    });
  }
}

function fillPolyfill () {
  if (!Array.prototype.fill) {
    Array.prototype.fill = function(value) {

      // Steps 1-2.
      if (this == null) {
        throw new TypeError('this is null or not defined');
      }

      var O = Object(this);

      // Steps 3-5.
      var len = O.length >>> 0;

      // Steps 6-7.
      var start = arguments[1];
      var relativeStart = start >> 0;

      // Step 8.
      var k = relativeStart < 0 ?
      Math.max(len + relativeStart, 0) :
      Math.min(relativeStart, len);

      // Steps 9-10.
      var end = arguments[2];
      var relativeEnd = end === undefined ?
      len : end >> 0;

      // Step 11.
      var final = relativeEnd < 0 ?
      Math.max(len + relativeEnd, 0) :
      Math.min(relativeEnd, len);

      // Step 12.
      while (k < final) {
        O[k] = value;
        k++;
      }

      // Step 13.
      return O;
    };
  }
}

module.exports = function () {
  promisePolyfill();
  removePolyfill();
  findPolyfill();
  fillPolyfill();
};

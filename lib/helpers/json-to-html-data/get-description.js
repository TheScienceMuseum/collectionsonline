'use strict';

var getNestedProperty = require('../../nested-property');
var getPrimaryValue = require('../../get-primary-value');
var formatDescription = require('./format-description');

function getWebDescription (data) {
  var desc = getNestedProperty(data, 'attributes.description');
  var webDesc;

  if (desc) {
    webDesc = desc
    .filter(function (d) {
      return d.type === 'web description';
    })
    .map(function (d) {
      return d.value;
    })[0];
  }

  return webDesc || '';
}

module.exports = function (data) {
  var formattedDescriptions = {};
  var typeDescriptions = {
    people: [
      'attributes.note',
      'attributes.description',
      'attributes.content.description'
    ],
    objects: [
      'attributes.description',
      'attributes.content.description',
      'attributes.note'
    ],
    documents: [
      'attributes.content.description',
      'attributes.description',
      'attributes.note']
  };
  var preferredDescriptions = typeDescriptions[data.type];
  var descriptions = { web: getWebDescription(data) || null };
  var i, desc, prefDesc;

  for (i = 0; i < preferredDescriptions.length; i++) {
    prefDesc = getNestedProperty(data, preferredDescriptions[i]);
    desc = getPrimaryValue(prefDesc) || null;
    if (desc && (!descriptions.web || descriptions.web.indexOf(desc) === -1)) {
      descriptions.primary = desc;
      break;
    }
  }

  formattedDescriptions = Object.keys(descriptions).reduce(function (prev, curr) {
    if (typeof descriptions[curr] === 'string') {
      prev[curr] = formatDescription(descriptions[curr]);
    }

    return prev;
  }, {});

  return (formattedDescriptions.primary || formattedDescriptions.web)
    ? formattedDescriptions
    : null;
};


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

function getBriefBiog (data) {
  var desc = getNestedProperty(data, 'attributes.description');
  var briefBiog;

  if (desc) {
    briefBiog = desc
      .filter(function (d) {
        return d.type === 'brief biography';
      })
      .map(function (d) {
        return d.value;
      })[0];
  }

  return briefBiog || '';
}

module.exports = function (data) {
  var formattedDescriptions = {};
  var typeDescriptions = {
    people: [
      'attributes.description',
      'attributes.content.description'
      // 'attributes.note',
    ],
    objects: [
      'attributes.description',
      'attributes.content.description'
    ],
    documents: [
      'attributes.content.description',
      'attributes.description']
  };
  var preferredDescriptions = typeDescriptions[data.type];
  var descriptions = {
    web: getWebDescription(data) || null,
    briefbiog: getBriefBiog(data) || null
  };
  var i, desc, prefDesc;

  for (i = 0; i < preferredDescriptions.length; i++) {
    prefDesc = getNestedProperty(data, preferredDescriptions[i]);
    desc = getPrimaryValue(prefDesc) || null;
    // deal with case where description and web description are the same
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

  // console.log(formattedDescriptions);

  return (formattedDescriptions.primary || formattedDescriptions.web || formattedDescriptions.briefbiog)
    ? formattedDescriptions
    : null;
};

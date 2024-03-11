'use strict';

const getNestedProperty = require('../../nested-property');
const getPrimaryValue = require('../../get-primary-value');
const formatDescription = require('./format-description');

function getWebDescription(data) {
  const desc = getNestedProperty(data, 'attributes.description');

  let webDesc;

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

function getBriefBiog(data) {
  const desc = getNestedProperty(data, 'attributes.description');
  let briefBiog;

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
  let formattedDescriptions = {};
  const typeDescriptions = {
    people: ['attributes.description', 'attributes.content.description.value'],
    objects: ['attributes.description', 'attributes.content.description'],
    documents: ['attributes.content.description', 'attributes.description'],
  };
  const preferredDescriptions = typeDescriptions[data?.type];
  const descriptions = {
    web: getWebDescription(data) || null,
    briefbiog: getBriefBiog(data) || null,
  };
  let i, desc, prefDesc;

  for (i = 0; i < preferredDescriptions?.length; i++) {
    prefDesc = getNestedProperty(data, preferredDescriptions[i]);
    desc = getPrimaryValue(prefDesc) || null;
    // deal with case where description and web description are the same
    if (desc && (!descriptions.web || descriptions.web.indexOf(desc) === -1)) {
      descriptions.primary = desc;
      break;
    }
  }

  formattedDescriptions = Object.keys(descriptions).reduce(function (
    prev,
    curr
  ) {
    if (typeof descriptions[curr] === 'string') {
      prev[curr] = formatDescription(descriptions[curr]);
    }

    return prev;
  },
  {});

  return formattedDescriptions.primary ||
    formattedDescriptions.web ||
    formattedDescriptions.briefbiog
    ? formattedDescriptions
    : null;
};

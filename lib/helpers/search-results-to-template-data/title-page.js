'use strict';

/**
* see #699
* category : {name of the category} | Science Museum Group Collection
* museum (+ gallery): On display at {name muserum} : {name gallery} | Science Museum Group Collection
* category + museum + gallery:
*  {name of the category} on display at {name muserum} : {name gallery} | Science Museum Group Collection
*/

const nameFromFilter = function (selectedFilters) {
  let name = '';
  const category = selectedFilters.categories && Object.keys(selectedFilters.categories)[0];
  const collection = selectedFilters.collection && Object.keys(selectedFilters.collection)[0];
  let museum = selectedFilters.museum && Object.keys(selectedFilters.museum)[0];
  const gallery = selectedFilters.gallery && Object.keys(selectedFilters.gallery)[0];

  const exclude = ['categories', 'collection', 'museum', 'gallery', 'type', 'page[size]', 'page[type]', 'page[number]'];

  // check that only the filter categories, museum or gallery are selected
  const otherFilters = Object.keys(selectedFilters).filter(function (f) {
    return exclude.indexOf(f) === -1;
  });

  // temporary fix for renamed museum (this really needs updating in the ES index)
  if (museum === 'National Media Museum') { museum = 'National Science and Media Museum'; }
  if (museum === 'Museum of Science and Industry') { museum = 'Science and Industry Museum'; }

  // no other filters
  if (otherFilters.length === 0) {
    name += category ? category + ' ' : '';
    name += collection ? collection + ' ' : '';
    name += museum ? 'on display at the ' + museum + ' ' : '';
    name += gallery ? '| ' + gallery + ' ' : '';
    // capitalise:
    // if category not define "on display..." is converted to "On display..."
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
};

module.exports = function (q, selectedFilters) {
  const name = nameFromFilter(selectedFilters);

  // if no search specified and a name is defined
  if (!q && name) {
    return name + '| Science Museum Group Collection';
  }

  return 'Search our collection | Science Museum Group Collection';
};

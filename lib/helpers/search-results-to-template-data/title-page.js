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

  let museum = selectedFilters.museum && Object.keys(selectedFilters.museum)[0];

  const exclude = [
    'categories',
    'collection',
    'museum',
    'gallery',
    'occupation',
    'type',
    'object_type',
    'material',
    'makers',
    'page[size]',
    'page[type]',
    'page[number]',
    'subgroup'
  ];

  // check that only the filter categories, museum or gallery are selected
  const otherFilters = Object.keys(selectedFilters).filter(function (f) {
    return exclude.indexOf(f) === -1 && f !== '';
  });

  // temporary fix for renamed museum (this really needs updating in the ES index)
  if (museum === 'National Media Museum') {
    museum = 'National Science and Media Museum';
  }
  if (museum === 'Museum of Science and Industry') {
    museum = 'Science and Industry Museum';
  }

  // no other filters

  if (otherFilters.length === 0) {
    const filterKeys = Object.keys(selectedFilters);
    if (filterKeys.length >= 2) {
      // filters out unnecessary keys;
      const filterType = filterKeys.filter(
        (k) => k !== '' && k !== 'search' && k !== 'type'
      );
      if (filterType.length > 0) {
        const firstFilterType = filterType[0];
        const museum =
          selectedFilters.museum && Object.keys(selectedFilters.museum)[0];
        const gallery =
          selectedFilters.gallery && Object.keys(selectedFilters.gallery)[0];
        const category =
          selectedFilters.categories &&
          Object.keys(selectedFilters.categories)[0];

        // Checks for specific config for nested filters
        if (category && museum && gallery) {
          name += handleFilter('museumAndCategory', {
            museum,
            gallery,
            category
          });
        } else if (museum && gallery) {
          name += handleFilter('museumAndGallery', { museum, gallery });
        } else {
          const filterValue =
            selectedFilters[firstFilterType] &&
            Object.keys(selectedFilters[firstFilterType])[0];
          name += handleFilter(firstFilterType, filterValue); // single case
        }
      }
    }

    // capitalise:
    // if category not define "on display..." is converted to "On display..."
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name;
};

// handles config of string value for specific filters
function handleFilter (filterType, filterValue) {
  if (filterValue === 'all') {
    return '';
  }
  if (filterValue) {
    switch (filterType) {
      case 'museum':
        return 'on display at the ' + filterValue + ' ';
      case 'gallery':
        return '| ' + filterValue + ' ';
      case 'museumAndCategory':
        return (
          filterValue.category +
          ' on display at the ' +
          filterValue.museum +
          ' | ' +
          filterValue.gallery +
          ' '
        );
      case 'museumAndGallery':
        return (
          'on display at the ' +
          filterValue.museum +
          ' | ' +
          filterValue.gallery +
          ' '
        );
      case 'makers':
        return 'Made by' + ' ' + filterValue + ' ';
      case 'all':
        return '';
      case 'search':
        return '';
      case 'page[size]':
        return '';

      case 'page[type]':
        return '';

      default:
        return filterValue + ' ';
    }
  }
  return '';
}

// titles by search tab (without filters)
function defaultText (type) {
  switch (type) {
    case 'people':
      return 'People and Companies';
    case 'documents':
      return 'Documents and Archives';

    case 'objects':
      return 'Objects';

    case 'group':
      return 'Explore objects by topic';

    default:
      return 'Search our collection';
  }
}
module.exports = function (q, selectedFilters, type) {
  const name = nameFromFilter(selectedFilters);
  if (!q && name) {
    return name + '| Science Museum Group Collection'; // if no search specified and a name is defined
  }

  return `${defaultText(type)} | Science Museum Group Collection`; // default (by search tab)
};

/**
 * Create the post filter object depending on which category the user is on
 */

module.exports = function (queryParams, filters) {
  let postFilter = {};

  if (queryParams.type === 'people') {
    postFilter = filters.people;
  }

  if (queryParams.type === 'objects') {
    postFilter = filters.objects;
  }

  if (queryParams.type === 'documents') {
    postFilter = filters.documents;
  }

  if (queryParams.type === 'group') {
    postFilter = filters.group;
  }

  if (queryParams.type === 'all') {
    postFilter = filters.all;
  }
  return postFilter;
};

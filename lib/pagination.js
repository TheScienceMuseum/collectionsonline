/*
Create a list of pagination pages. Returns an array of pages, possibly with
a `null` break item:

e.g. Pagination.pages(currentPageNumber = 0, totalPages = 10, opts = {createPageLink: 'http://...'})
[
  { pageNumber: 0, isCurrent: true, link: 'http://...' },
  { pageNumber: 1, isCurrent: false, link: 'http://...' },
  { pageNumber: 2, isCurrent: false, link: 'http://...' },
  { pageNumber: 3, isCurrent: false, link: 'http://...' },
  null,
  { pageNumber: 8, isCurrent: false, link: 'http://...' },
  { pageNumber: 9, isCurrent: false, link: 'http://...' }
]

`createPageLink` is a function that is passed the page object
{ pageNumber, isCurrent } and should return the URL to that page.
*/
exports.pages = (currentPageNumber, totalPages, opts) => {
  opts = opts || {};

  const createPageLink = opts.createPageLink;

  if (totalPages < 10) {
    return range(0, totalPages)
      .map((n) => createPage(n, currentPageNumber, createPageLink));
  }

  if (currentPageNumber < 5) {
    return range(0, currentPageNumber + 2)
      .map((n) => createPage(n, currentPageNumber, createPageLink))
      .concat(null)
      .concat([totalPages - 2, totalPages - 1]
        .map((n) => createPage(n, currentPageNumber, createPageLink)));
  }

  if (currentPageNumber > totalPages - 5) {
    return [0, 1]
      .map((n) => createPage(n, currentPageNumber, createPageLink))
      .concat(null)
      .concat(range(totalPages - 5, totalPages)
        .map((n) => createPage(n, currentPageNumber, createPageLink)));
  }

  return [0, 1, null,
    currentPageNumber - 1,
    currentPageNumber,
    currentPageNumber + 1,
    null, totalPages - 2, totalPages - 1
  ].map((n) => {
    return n === null
      ? null
      : createPage(n, currentPageNumber, createPageLink);
  });
};

function createPage (pageNumber, currentPageNumber, createPageLink) {
  const page = {
    pageNumber,
    isCurrent: currentPageNumber === pageNumber
  };

  if (createPageLink) {
    page.link = createPageLink(page);
  }

  return page;
}

// range(0, 2) => [0, 1]
// range(4, 7) => [4, 5, 6]
function range (from, to) {
  return new Array(to - from).fill(0).map((_, i) => from + i);
}

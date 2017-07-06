/*
Create a list of pagination pages. Returns an array of pages, possibly with
a `null` break item:

e.g. Pagination.pages(currentPageNumber = 0, totalPages = 10, createPageLink = 'http://...' })
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
  const maxLinks = opts.maxLinks || 6;

  var prependedArray;
  if (currentPageNumber === 0) {
    prependedArray = [];
  } else if (currentPageNumber === 1) {
    prependedArray = [createPage(0, currentPageNumber, createPageLink)];
  } else {
    prependedArray = [0, 1].map(function (n) { return createPage(n, currentPageNumber, createPageLink); });
  }
  if (currentPageNumber > 2) {
    prependedArray = prependedArray.concat(null);
  }

  if (totalPages - currentPageNumber - 1 < maxLinks) {
    const start = Math.max(0, totalPages - maxLinks);
    const end = Math.min(start + maxLinks, totalPages);

    return prependedArray
      .concat(range(start, end)
      .map((n) => createPage(n, currentPageNumber, createPageLink)));
  }

  return prependedArray
    .concat(range(currentPageNumber, currentPageNumber + (maxLinks - 2))
    .map((n) => createPage(n, currentPageNumber, createPageLink)))
    .concat([
      null,
      createPage(totalPages - 2, currentPageNumber, createPageLink),
      createPage(totalPages - 1, currentPageNumber, createPageLink)
    ]);
};

function createPage (pageNumber, currentPageNumber, createPageLink) {
  const page = { pageNumber, isCurrent: currentPageNumber === pageNumber };

  if (createPageLink) {
    page.link = createPageLink(page);
  }

  return page;
}

function range (from, to) {
  return new Array(to - from).fill(0).map((_, i) => from + i);
}

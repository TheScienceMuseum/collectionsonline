/*
Create a list of pagination pages. Returns an array of pages, possibly with
a `null` break item:

e.g. Pagination.pages({ currentPageNumber: 0, totalPages: 10, createPageLink })
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
exports.pages = ({ currentPageNumber, totalPages, maxLinks = 6, createPageLink = null }) => {
  maxLinks = maxLinks || 6; // Temporary fix to make tests work

  if (totalPages - currentPageNumber - 1 < maxLinks) {
    const start = totalPages - maxLinks;
    const end = Math.min(start + maxLinks, totalPages);

    return range(start, end)
      .map((n) => createPage(n, currentPageNumber, createPageLink));
  }

  return range(currentPageNumber, currentPageNumber + (maxLinks - 2))
    .map((n) => createPage(n, currentPageNumber, createPageLink))
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

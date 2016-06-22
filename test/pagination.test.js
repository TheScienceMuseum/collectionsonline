const test = require('tape');
const Pagination = require('../lib/pagination');

test('Should have break when > 6 pages are available', (t) => {
  t.plan(2);

  const opts = {
    currentPageNumber: 0,
    totalPages: 10,
    maxLinks: 6,
    createPageLink: (p) => `http://example.org/${p.pageNumber}`
  };

  const pages = Pagination.pages(opts);

  t.equal(pages.length, 7, 'Total pages was 7');
  t.notOk(pages[4], 'Found break at position 4');

  t.end();
});

test('Should set isCurrent on current page', (t) => {
  t.plan(2);

  const opts = {
    currentPageNumber: 3,
    totalPages: 10,
    maxLinks: 6,
    createPageLink: (p) => `http://example.org/${p.pageNumber}`
  };

  const pages = Pagination.pages(opts);
  const currentPage = pages.find((p) => p && p.isCurrent);

  t.ok(currentPage, 'Current page was found');
  t.equal(currentPage.pageNumber, 3, 'Current page number was correct');

  t.end();
});

test('Should not have break when <= 6 pages are available', (t) => {
  t.plan(7);

  const opts = {
    currentPageNumber: 0,
    totalPages: 6,
    maxLinks: 6,
    createPageLink: (p) => `http://example.org/${p.pageNumber}`
  };

  const pages = Pagination.pages(opts);

  t.equal(pages.length, 6, 'Total pages was 6');

  pages.forEach((page, i) => {
    t.notEqual(page, null, 'No break on page ' + i);
  });

  t.end();
});

test('Should not have break when current page is near end', (t) => {
  t.plan(7);

  const opts = {
    currentPageNumber: 7,
    totalPages: 10,
    maxLinks: 6,
    createPageLink: (p) => `http://example.org/${p.pageNumber}`
  };

  const pages = Pagination.pages(opts);

  t.equal(pages.length, 6, 'Total pages was 6');

  pages.forEach((page, i) => {
    t.notEqual(page, null, 'No break on page ' + page.pageNumber);
  });

  t.end();
});

test('Should show 3 pages when only 3 pages are available', (t) => {
  t.plan(1);

  const opts = {
    currentPageNumber: 0,
    totalPages: 3,
    maxLinks: 6,
    createPageLink: (p) => `http://example.org/${p.pageNumber}`
  };

  const pages = Pagination.pages(opts);

  t.equal(pages.length, 3, 'Total pages was 3');
  t.end();
});

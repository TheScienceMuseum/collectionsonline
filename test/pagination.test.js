const test = require('tape');
const Pagination = require('../lib/pagination');

[
  {
    message: 'No ellipses for less than 10 pages',
    currentPageNumber: 0,
    totalPages: 9,
    expected: [
      { pageNumber: 0, isCurrent: true, link: 'http://example.org/0' },
      { pageNumber: 1, isCurrent: false, link: 'http://example.org/1' },
      { pageNumber: 2, isCurrent: false, link: 'http://example.org/2' },
      { pageNumber: 3, isCurrent: false, link: 'http://example.org/3' },
      { pageNumber: 4, isCurrent: false, link: 'http://example.org/4' },
      { pageNumber: 5, isCurrent: false, link: 'http://example.org/5' },
      { pageNumber: 6, isCurrent: false, link: 'http://example.org/6' },
      { pageNumber: 7, isCurrent: false, link: 'http://example.org/7' },
      { pageNumber: 8, isCurrent: false, link: 'http://example.org/8' }
    ]
  },
  {
    message: 'No ellipses for less than 10 pages, from any current page',
    currentPageNumber: 4,
    totalPages: 9,
    expected: [
      { pageNumber: 0, isCurrent: false, link: 'http://example.org/0' },
      { pageNumber: 1, isCurrent: false, link: 'http://example.org/1' },
      { pageNumber: 2, isCurrent: false, link: 'http://example.org/2' },
      { pageNumber: 3, isCurrent: false, link: 'http://example.org/3' },
      { pageNumber: 4, isCurrent: true, link: 'http://example.org/4' },
      { pageNumber: 5, isCurrent: false, link: 'http://example.org/5' },
      { pageNumber: 6, isCurrent: false, link: 'http://example.org/6' },
      { pageNumber: 7, isCurrent: false, link: 'http://example.org/7' },
      { pageNumber: 8, isCurrent: false, link: 'http://example.org/8' }
    ]
  },
  {
    message: 'Large number results, first page',
    currentPageNumber: 0,
    totalPages: 12,
    expected: [
      { pageNumber: 0, isCurrent: true, link: 'http://example.org/0' },
      { pageNumber: 1, isCurrent: false, link: 'http://example.org/1' },
      null,
      { pageNumber: 10, isCurrent: false, link: 'http://example.org/10' },
      { pageNumber: 11, isCurrent: false, link: 'http://example.org/11' }
    ]
  },
  {
    message: 'Ellipses either side for non edge cases',
    currentPageNumber: 5,
    totalPages: 10,
    expected: [
      { pageNumber: 0, isCurrent: false, link: 'http://example.org/0' },
      { pageNumber: 1, isCurrent: false, link: 'http://example.org/1' },
      null, // ellipses
      { pageNumber: 4, isCurrent: false, link: 'http://example.org/4' },
      { pageNumber: 5, isCurrent: true, link: 'http://example.org/5' },
      { pageNumber: 6, isCurrent: false, link: 'http://example.org/6' },
      null, // ellipses
      { pageNumber: 8, isCurrent: false, link: 'http://example.org/8' },
      { pageNumber: 9, isCurrent: false, link: 'http://example.org/9' }
    ]
  },
  {
    message: 'No beginning ellipses for numbers near the start',
    currentPageNumber: 4,
    totalPages: 10,
    expected: [
      { pageNumber: 0, isCurrent: false, link: 'http://example.org/0' },
      { pageNumber: 1, isCurrent: false, link: 'http://example.org/1' },
      { pageNumber: 2, isCurrent: false, link: 'http://example.org/2' },
      { pageNumber: 3, isCurrent: false, link: 'http://example.org/3' },
      { pageNumber: 4, isCurrent: true, link: 'http://example.org/4' },
      { pageNumber: 5, isCurrent: false, link: 'http://example.org/5' },
      null, // ellipses
      { pageNumber: 8, isCurrent: false, link: 'http://example.org/8' },
      { pageNumber: 9, isCurrent: false, link: 'http://example.org/9' }
    ]
  },
  {
    message: 'No ending ellipses for numbers near the end',
    currentPageNumber: 6,
    totalPages: 10,
    expected: [
      { pageNumber: 0, isCurrent: false, link: 'http://example.org/0' },
      { pageNumber: 1, isCurrent: false, link: 'http://example.org/1' },
      null, // ellipses
      { pageNumber: 5, isCurrent: false, link: 'http://example.org/5' },
      { pageNumber: 6, isCurrent: true, link: 'http://example.org/6' },
      { pageNumber: 7, isCurrent: false, link: 'http://example.org/7' },
      { pageNumber: 8, isCurrent: false, link: 'http://example.org/8' },
      { pageNumber: 9, isCurrent: false, link: 'http://example.org/9' }
    ]
  }
].forEach((testObj) => {
  test(
    (testObj.message || 'Pagination') + ' - ' +
      'Current Page: ' + testObj.currentPageNumber + ', ' +
      'Total Pages: ' + testObj.totalPages,
    (t) => {
      t.plan(1);

      const opts = {
        maxLinks: 6,
        createPageLink: (p) => `http://example.org/${p.pageNumber}`
      };

      const currentPageNumber = testObj.currentPageNumber;
      const totalPages = testObj.totalPages;

      const actual = Pagination.pages(currentPageNumber, totalPages, opts);
      const expected = testObj.expected;

      const message = constructTestMessage(actual, expected);

      t.deepEqual(actual, expected, message);
      t.end();
    }
  );
});

function constructTestMessage (actual, expected) {
  let isWrong;

  actual.forEach((obj, i) => {
    if (isWrong) {
      return;
    }

    if (obj === null || expected[i] === null) {
      if (obj === null && expected[i] === null) {
        return;
      }
      isWrong = true;
      return;
    }

    ['isCurrent', 'link', 'pageNumber'].forEach((key) => {
      if (obj[key] !== expected[i][key]) {
        isWrong = true;
      }
    });
  });

  const constructReadable = (pageObjs) => {
    return pageObjs
      .map((pageObj) => pageObj === null ? '...' : pageObj.pageNumber)
      .join(', ');
  };

  if (isWrong) {
    return 'Expected: ' + constructReadable(expected) + '\n' +
           'Actually got: ' + constructReadable(actual);
  } else {
    return 'Pages match';
  }
}

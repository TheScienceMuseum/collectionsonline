const test = require('tape');
const formatArchiveDate = require('../lib/helpers/format-archive-date');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'year-only values keep the tight dash', (t) => {
  t.equal(formatArchiveDate('1945'), '1945', 'single year');
  t.equal(formatArchiveDate('1998-2005'), '1998-2005', 'year range unchanged');
  t.equal(formatArchiveDate('1998-1998'), '1998', 'identical years collapse');
  t.end();
});

test(file + 'a 1 January - 31 December span is treated as a year range', (t) => {
  t.equal(
    formatArchiveDate('1810-01-01-1850-12-31'),
    '1810-1850',
    'padded year range'
  );
  t.equal(
    formatArchiveDate('1846-01-01-1846-12-31'),
    '1846',
    'padded single year'
  );
  t.equal(
    formatArchiveDate('1810-01-01-1850-12-30'),
    '1 January 1810 - 30 December 1850',
    'not padded — one day short, so the dates are kept'
  );
  t.equal(
    formatArchiveDate('1810-01-02-1850-12-31'),
    '2 January 1810 - 31 December 1850',
    'not padded — starts on the 2nd, so the dates are kept'
  );
  t.end();
});

test(file + 'single dates are spelled out', (t) => {
  t.equal(formatArchiveDate('1936-10'), 'October 1936', 'year and month');
  t.equal(formatArchiveDate('1649-10-15'), '15 October 1649', 'year, month and day');
  t.end();
});

test(file + 'ranges read as ranges', (t) => {
  t.equal(
    formatArchiveDate('1945-01-01-1947-11-23'),
    '1 January 1945 - 23 November 1947',
    'full date range'
  );
  t.equal(
    formatArchiveDate('1848-03-10-1849-09-15'),
    '10 March 1848 - 15 September 1849',
    'full date range across years'
  );
  t.equal(
    formatArchiveDate('1955-2018-05-31'),
    '1955 - 31 May 2018',
    'year to full date'
  );
  t.equal(
    formatArchiveDate('1868-1996-09'),
    '1868 - September 1996',
    'year to month'
  );
  t.end();
});

test(file + 'shared year or month is not repeated', (t) => {
  t.equal(
    formatArchiveDate('1945-01-1945-11'),
    'January - November 1945',
    'months within one year'
  );
  t.equal(
    formatArchiveDate('1945-01-01-1945-01-23'),
    '1 - 23 January 1945',
    'days within one month'
  );
  t.equal(
    formatArchiveDate('1945-01-1945-01'),
    'January 1945',
    'identical endpoints collapse to a single date'
  );
  t.end();
});

test(file + 'unparseable values pass through unchanged', (t) => {
  t.equal(formatArchiveDate('circa 1945'), 'circa 1945', 'free text');
  t.equal(formatArchiveDate('1940s'), '1940s', 'decade');
  t.equal(formatArchiveDate('1945-13'), '1945-13', 'impossible month');
  t.equal(formatArchiveDate('1945-01-01-1947-11-23-1950'), '1945-01-01-1947-11-23-1950', 'more than two parts');
  t.equal(formatArchiveDate(''), '', 'empty string');
  t.equal(formatArchiveDate(null), null, 'null');
  t.equal(formatArchiveDate(undefined), undefined, 'undefined');
  t.end();
});

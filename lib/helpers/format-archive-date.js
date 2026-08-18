const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

// Spaced dash, matching the existing person lifespan format ("1900 - 1980").
// Bare year ranges stay tight ("1998-2005") — the spaced form only earns its
// keep when the endpoints are multi-word.
const SEPARATOR = ' - ';
const YEAR_SEPARATOR = '-';

/**
 * Archive `creation.date[].value` strings are hyphen-joined numeric parts, e.g.
 *   1998-2005              (year range)
 *   1936-10                (year + month)
 *   1945-01-01-1947-11-23  (full date range)
 *   1955-2018-05-31        (year → year + month + day)
 *
 * Years are always 4 digits and months/days always 2, so splitting on the
 * hyphen and grouping by token length recovers the parts unambiguously.
 * Returns null for anything that isn't purely numeric parts, or that yields
 * more than two parts (a range has at most a start and an end).
 */
function parseParts (value) {
  const tokens = value.split('-');
  const parts = [];
  let current = null;

  for (const token of tokens) {
    if (/^\d{4}$/.test(token)) {
      current = { year: Number(token) };
      parts.push(current);
    } else if (/^\d{2}$/.test(token) && current) {
      if (current.month === undefined) {
        const month = Number(token);
        if (month < 1 || month > 12) return null;
        current.month = month;
      } else if (current.day === undefined) {
        const day = Number(token);
        if (day < 1 || day > 31) return null;
        current.day = day;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  return parts.length === 1 || parts.length === 2 ? parts : null;
}

function formatPart (part) {
  if (part.month === undefined) return String(part.year);
  const month = MONTHS[part.month - 1];
  if (part.day === undefined) return month + ' ' + part.year;
  return part.day + ' ' + month + ' ' + part.year;
}

function isSamePart (a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * A range running 1 January → 31 December is a year range the cataloguing
 * system padded out to full dates, not a genuine day-level span. Rendering it
 * as "1 January 1810 - 31 December 1850" claims a precision the record doesn't
 * have, so drop back to the years it actually means.
 */
function isPaddedYearSpan (from, to) {
  return (
    from.month === 1 && from.day === 1 && to.month === 12 && to.day === 31
  );
}

/**
 * Turns a machine-shaped archive date value into something readable:
 *   1945-01-01-1947-11-23 → 1 January 1945 - 23 November 1947
 *   1945-01-1945-11       → January - November 1945
 *   1936-10               → October 1936
 *   1810-01-01-1850-12-31 → 1810-1850
 *
 * Values made up only of years (1998, 1998-2005) already read well and are
 * returned as they are.
 *
 * Anything that doesn't parse as numeric date parts (free text, "circa 1945",
 * "1940s") is returned untouched.
 */
module.exports = function formatArchiveDate (value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  let parts = parseParts(trimmed);
  if (!parts) return value;

  if (parts.length === 2 && isPaddedYearSpan(parts[0], parts[1])) {
    parts = [{ year: parts[0].year }, { year: parts[1].year }];
  }

  if (parts.length === 1) return formatPart(parts[0]);

  const [from, to] = parts;
  if (isSamePart(from, to)) return formatPart(from);

  if (from.month === undefined && to.month === undefined) {
    return from.year + YEAR_SEPARATOR + to.year;
  }

  // Collapse a shared trailing year/month so ranges within one year or one
  // month don't repeat themselves: "January - November 1945".
  if (from.year === to.year && from.month !== undefined && to.month !== undefined) {
    if (from.month === to.month && from.day !== undefined && to.day !== undefined) {
      return (
        from.day + SEPARATOR + to.day + ' ' + MONTHS[to.month - 1] + ' ' + to.year
      );
    }
    if (from.day === undefined && to.day === undefined) {
      return (
        MONTHS[from.month - 1] + SEPARATOR + MONTHS[to.month - 1] + ' ' + to.year
      );
    }
  }

  return formatPart(from) + SEPARATOR + formatPart(to);
};

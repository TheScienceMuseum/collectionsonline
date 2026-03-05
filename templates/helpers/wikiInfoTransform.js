// Priority order for wiki property display.
// Keys listed here appear first (in this order); all others follow in original order.
const PRIORITY = ['P112', 'P127', 'P169', 'P108', 'P1056', 'P800'];

module.exports = (obj) => {
  const entries = Object.entries(obj).map(([key, value]) => ({ key, value }));
  const priority = entries.filter(e => PRIORITY.includes(e.key));
  const rest = entries.filter(e => !PRIORITY.includes(e.key));
  priority.sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
  return [...priority, ...rest];
};

// Priority order for wiki property display.
// Keys listed here appear first (in this order); all others follow in original order.
const PRIORITY = [
  // 'P571',  // Inception     — currently hidden, uncomment to reinstate
  // 'P1448', // Official Name — currently hidden, uncomment to reinstate
  'P112', 'P127', 'P169', 'P108', 'P1056', 'P800'
];

// Properties excluded from the display panel.
// Comment out individual lines to reinstate a section.
const SKIP = new Set([
  'P571', // Inception
  'P1448', // Official Name
  'P138' // Named After
]);

module.exports = (obj) => {
  const entries = Object.entries(obj)
    .filter(([key]) => !SKIP.has(key))
    .map(([key, value]) => ({ key, value }));
  const priority = entries.filter(e => PRIORITY.includes(e.key));
  const rest = entries.filter(e => !PRIORITY.includes(e.key));
  priority.sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
  return [...priority, ...rest];
};

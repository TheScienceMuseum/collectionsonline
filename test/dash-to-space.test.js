const test = require('tape');
const dashToSpace = require('../lib/helpers/dash-to-space');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'decodes triple-dash (space-dash-space) correctly', (t) => {
  t.equal(dashToSpace('box---container'), 'box - container', 'triple dash becomes space-dash-space');
  t.equal(dashToSpace('toy---recreational-artefact'), 'toy - recreational artefact', 'triple dash plus single dashes');
  t.equal(dashToSpace('punch---marking-tool'), 'punch - marking tool', 'triple dash plus single dash');
  t.end();
});

test(file + 'decodes single-dash (encoded space) correctly', (t) => {
  t.equal(dashToSpace('film-poster'), 'film poster', 'single dash becomes space');
  t.equal(dashToSpace('x-rays'), 'x rays', 'single dash in x-rays becomes space');
  t.equal(dashToSpace('polytetrafluoroethylene-(ptfe)'), 'polytetrafluoroethylene (ptfe)', 'single dash before parens');
  t.end();
});

test(file + 'round-trip: paramify encoding decodes correctly', (t) => {
  const encodeValue = (v) => v.split(' ').join('-');
  const cases = [
    'box - container',
    'toy - recreational artefact',
    'punch - marking tool',
    'film poster'
  ];
  cases.forEach((original) => {
    const encoded = encodeValue(original);
    const decoded = dashToSpace(encoded);
    t.equal(decoded, original, `"${original}" round-trips correctly`);
  });
  t.end();
});

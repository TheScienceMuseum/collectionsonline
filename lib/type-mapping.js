// Mapping internal types to external types (plurals first!)
const inToExMap = {
  objects: 'objects',
  object: 'objects',
  agents: 'people',
  agent: 'people',
  archives: 'documents',
  archive: 'documents'
};

// Flip for external to internal
const exToInMap = Object.keys(inToExMap).reduce((map, key) => {
  map[inToExMap[key]] = key;
  return map;
}, {});

const inToExRegx = new RegExp('(' + Object.keys(inToExMap).join('|') + ')');
const exToInRegx = new RegExp('(' + Object.keys(exToInMap).join('|') + ')');

exports.toExternal = (type) => (type + '').replace(inToExRegx, (match) => inToExMap[match]);
exports.toInternal = (type) => (type + '').replace(exToInRegx, (match) => exToInMap[match]);

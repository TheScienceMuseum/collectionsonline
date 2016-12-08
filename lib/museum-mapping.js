var shortMuseums = {
  'scm': 'Science Museum',
  'nrm': 'National Railway Museum',
  'msi': 'Museum of Science and Industry',
  'nmem': 'National Media Museum'
};

var longMuseums = {
  'Science Museum': 'scm',
  'National Railway Museum': 'nrm',
  'Museum of Science and Industry': 'msi',
  'National Media Museum': 'nmem'
};

exports.toLong = function (mus) {
  return shortMuseums[mus] || mus;
};

exports.toShort = function (mus) {
  return longMuseums[mus] || mus;
};

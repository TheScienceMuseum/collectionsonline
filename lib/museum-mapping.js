var shortMuseums = {
  'scm': 'Science Museum',
  'nrm': 'National Railway Museum',
  'msi': 'Museum of Science and Industry',
  'nmem': 'National Media Museum'
};

var longMuseums = {
  'science museum': 'scm',
  'national railway museum': 'nrm',
  'museum of science and industry': 'msi',
  'national media museum': 'nmem'
};

exports.toLong = function (mus) {
  return shortMuseums[mus] || shortMuseums[longMuseums[decodeURIComponent(mus.toLowerCase())]] || mus;
};

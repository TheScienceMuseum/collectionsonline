var shortMuseums = {
  'scm': 'Science Museum',
  'nrm': 'National Railway Museum',
  'msi': 'Museum of Science and Industry',
  'nmem': 'National Media Museum',
  'locomotion': 'Locomotion'
};

var longMuseums = {
  'science museum': 'scm',
  'national railway museum': 'nrm',
  'museum of science and industry': 'msi',
  'national media museum': 'nmem',
  'locomotion': 'locomotion'
};

exports.toLong = function (mus) {
  return shortMuseums[mus] || shortMuseums[longMuseums[decodeURIComponent(mus.toLowerCase().split('-').join(' '))]] || mus;
};

const shortMuseums = {
  scm: 'Science Museum',
  nrm: 'National Railway Museum',
  msi: 'Museum of Science and Industry',
  nmem: 'National Media Museum',
  nsmm: 'National Science and Media Museum',
  locomotion: 'Locomotion'
};

const longMuseums = {
  'science museum': 'scm',
  'national railway museum': 'nrm',
  'museum of science and industry': 'msi',
  'national media museum': 'nmem',
  'national cience and media museum': 'nsmm',
  locomotion: 'locomotion'
};

exports.toLong = function (mus) {
  return shortMuseums[mus] || shortMuseums[longMuseums[decodeURIComponent(mus.toLowerCase().split('-').join(' '))]] || mus;
};

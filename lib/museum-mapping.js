const shortMuseums = {
  scm: 'Science Museum',
  nrm: 'National Railway Museum',
  sim: 'Science and Industry Museum',
  nsmm: 'National Science and Media Museum',
  locomotion: 'Locomotion'
};

const longMuseums = {
  'science museum': 'scm',
  'national railway museum': 'nrm',
  'science and industry museum': 'sim',
  'national science and media museum': 'nsmm',
  locomotion: 'locomotion'
};

exports.toLong = function (mus) {
  return shortMuseums[mus] || shortMuseums[longMuseums[decodeURIComponent(mus.toLowerCase().split('-').join(' '))]] || mus;
};

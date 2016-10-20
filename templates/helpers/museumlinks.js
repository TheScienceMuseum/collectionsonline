module.exports = function (museum) {
  var links = {
    'Science Museum': 'http://www.sciencemuseum.org.uk/visitmuseum',
    'National Railway Museum': 'http://www.nrm.org.uk/planavisit/',
    'Museum of Science and Industry': 'http://msimanchester.org.uk/visit',
    'National Media Museum': 'http://www.nationalmediamuseum.org.uk/planavisit'
  };
  return links[museum];
};

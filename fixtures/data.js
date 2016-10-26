module.exports = {
  title: 'Science Museum Group Collection',
  titlePage: 'Science Museum Group Collection',
  strap: 'Search our collection',
  intro: 'Explore over 150,000 objects and archives from the Science Museum, Museum of Science and Industry, National Media Museum and National Railway Museum.',
  collectionGroup: [{
    title: 'See what’s on display',
    collection: [{
      type: 'collection',
      title: 'Science Museum',
      description: 'London museum and library of science. Exhibitions cover all areas of science and technology.',
      figure: '/assets/img/home/collections/sciencemuseum.jpg',
      columns: 'small-6 medium-3',
      link: '/scm'
    }, {
      type: 'collection',
      title: 'Museum of Science & Industry',
      figure: '/assets/img/home/collections/msi.jpg',
      description: 'Stories about ideas that change the world, from the Industrial Revolution to today and beyond.',
      columns: 'small-6 medium-3',
      link: '/msi'
    }, {
      type: 'collection',
      title: 'National Media Museum',
      figure: '/assets/img/home/collections/nmm.jpg',
      description: 'The National Photography, Cinematography, Television and New Media Collections',
      columns: 'small-6 medium-3',
      link: '/nmem'
    }, {
      type: 'collection',
      title: 'National Railway Museum',
      figure: '/assets/img/home/collections/nrm.jpg',
      description: 'Home to the UK’s national rail collection.',
      columns: 'small-6 medium-3',
      link: '/nrm'
    }]
  }, {
    title: 'Explore by theme/collection',
    collection: [{
      type: 'collection',
      title: 'Locomotives and Rolling Stock',
      description: 'Search within 280 locomotives and rolling stock from the collection',
      figure: '/assets/img/example/collections/railways.jpg',
      columns: 'small-6 medium-3',
      link: '/search?q=Railways'
    }, {
      type: 'collection',
      title: 'Art',
      figure: '/assets/img/home/collections/art.jpg',
      description: '[EMILY To send some blurb here!]',
      columns: 'small-6 medium-3',
      link: '/search?q=Art'
    }, {
      type: 'collection',
      title: 'The Babbage Papers',
      figure: '/assets/img/home/collections/babbage.jpg',
      description: 'The drawings and papers of mathematician and computer pioneer Charles Babbage',
      columns: 'small-6 medium-3',
      link: '/search?q=babbage'
    }, {
      type: 'collection',
      title: 'Mathematics',
      description: 'Explore the objects in Mathematics: The Winton Gallery ',
      figure: '/assets/img/home/collections/mathematics.jpg',
      columns: 'small-6 medium-3',
      link: '/search?q=mathematics'
    }]
  }]
};

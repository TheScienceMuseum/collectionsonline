const museums = require('./museums');
module.exports = {
  site: [
    { url: '/search', name: 'Search' },
    { url: '/explore', name: 'Explore' },
    { url: '/about', name: 'About' }
  ],
  footer: [
    {
      name: 'Privacy and cookies',
      url: 'https://group.sciencemuseum.org.uk/privacy-policy/'
    },
    {
      name: 'Terms and conditions',
      url: 'https://group.sciencemuseum.org.uk/terms-and-conditions/'
    },
    {
      name: 'Web accessibility',
      url: 'https://www.sciencemuseumgroup.org.uk/web-accessibility/'
    }
  ],
  global: [
    {
      url: 'https://collection.sciencemuseumgroup.org.uk/',
      name: 'Collection',
      current: true
    },
    {
      url: 'https://learning.sciencemuseumgroup.org.uk/',
      name: 'Learning'
    },
    {
      url: 'https://www.sciencemuseumgroup.org.uk/',
      name: 'The group'
    },
    {
      url: '#',
      name: 'Visit us',
      items: museums.links
    }
  ]
};

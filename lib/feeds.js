const cache = require('../bin/cache.js');

// Article endpoints on each museum website
const endpoints = [
  {
    label: 'National Science and Media Museum',
    url: 'https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science and Industry Musem',
    url: 'https://www.scienceandindustrymuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science Museum',
    url: 'https://www.sciencemuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Railway Museum',
    url: 'https://www.railwaymuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science Museum Blog',
    url: 'https://blog.sciencemuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  // {
  //   label: 'Learning Resources',
  //   url: 'https://learning.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage'
  // },
  {
    label: 'Railway Museum Blog',
    url: 'https://blog.railwaymuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Science and Media Museum Blog',
    url: 'https://blog.scienceandmediamuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Science and Industry Museum Blog',
    url: 'https://blog.scienceandindustrymuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Science Museum Group',
    url: 'https://www.sciencemuseumgroup.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science Museum Group Blog',
    url: 'https://blog.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage'
  }
];

// Function to fetch and cache data from an endpoint
async function fetchAndCacheEndpoint (endpoint) {
  try {
    const response = await fetch(endpoint.url, {
      timeout: 8000,
      headers: { 'User-Agent': 'SMG Collection Site 1.0' }
    });

    const data = await response.json();
    await cacheEndpoints(cache, endpoint, data);
  } catch (err) {
    console.error(`Failed to fetch ${endpoint.label}:`, err.message);
  }
}

// Function to cache data in the cache
async function cacheEndpoints (cache, endpoint, data) {
  try {
    if (!cache || !cache.isReady()) {
      return;
    }
    const url = endpoint.url;
    await cache.set({ segment: 'feed', id: url }, data, 100000000);
    console.log(`Feed successfully cached: ${endpoint.label}`);
  } catch (err) {
    console.error("Couldn't cache item:", err.message);
  }
}

// Export a function to trigger caching for all endpoints
module.exports = async () => {
  for (const endpoint of endpoints) {
    await fetchAndCacheEndpoint(endpoint);
  }
};

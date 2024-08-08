exports.fetchCache = async function (cache, qCode) {
  try {
    if (!cache) {
      console.debug('There is no cache.');
      return;
    }

    await cache.start();

    if (!cache.isReady()) {
      console.debug('Cache is not connected.');
      return;
    }
    const cached = await cache.get({ segment: 'wikidata', id: qCode });
    return cached;
  } catch (err) {
    console.debug("Couldn't cache item:", err);
  } finally {
    await cache.stop();
  }
};

exports.setCache = async function (cache, qCode, data) {
  try {
    if (!cache) {
      console.debug('There is no cache.');
      return;
    }
    await cache.start();

    if (!cache.isReady()) {
      console.debug('Cache is not connected.');
      return;
    }
    await cache.set({ segment: 'wikidata', id: qCode }, data, 86400000);
    console.log('wikidata successfully cached');
  } catch (err) {
    console.debug("Couldn't cache item:", err);
  } finally {
    await cache.stop();
  }
};

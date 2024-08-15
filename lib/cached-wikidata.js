exports.fetchCache = async function (cache, qCode, clearCache = undefined) {
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

    if (cached && clearCache !== undefined) {
      await cache.drop({ segment: 'wikidata', id: qCode });
      console.log('cache has been cleared');
      return null;
    }

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
    await cache.set({ segment: 'wikidata', id: qCode }, data, 2629746000);
    console.log('wikidata successfully cached');
  } catch (err) {
    console.debug("Couldn't cache item:", err);
  } finally {
    await cache.stop();
  }
};

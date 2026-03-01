exports.fetchCache = async function (cache, qCode, clearCache = undefined) {
  try {
    if (!cache || !cache.isReady()) {
      return null;
    }
    const cached = await cache.get({ segment: 'wikidata', id: qCode });
    if (cached && clearCache !== undefined) {
      await cache.drop({ segment: 'wikidata', id: qCode });
      return null;
    }
    return cached;
  } catch (err) {
    console.debug("Couldn't fetch from wikidata cache:", err.message);
    return null;
  }
};

exports.setCache = async function (cache, qCode, data, clear = undefined) {
  try {
    if (!cache || !cache.isReady()) {
      return null;
    }
    // Always write — the old entry was already dropped by fetchCache when clear is set,
    // so skipping the write here (the previous behaviour) left Redis with stale data
    // after a ?clear request.
    await cache.set({ segment: 'wikidata', id: qCode }, data, 2629746000);
    return null;
  } catch (err) {
    console.debug("Couldn't write to wikidata cache:", err.message);
    return null;
  }
};

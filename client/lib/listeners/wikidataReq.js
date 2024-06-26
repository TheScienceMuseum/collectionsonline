module.exports = async function initiateWikidataRequest (qCode) {
  try {
    const response = await fetch(qCode, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP error status: ${response.status}`);
    }
    const apiUrlString = await response.text();
    return apiUrlString + '&origin=*';
  } catch (error) {
    console.error('Error initiating Wikidata request:', error);
    throw error;
  }
};

import { WBK } from 'wikibase-sdk';
const wbk = WBK({
  instance: 'https://my-wikibase-instan.se',
  sparqlEndpoint: 'https://query.my-wikibase-instan.se/sparql' // Required to use `sparqlQuery` and `getReverseClaims` functions, optional otherwise
});

module.exports = wbk;

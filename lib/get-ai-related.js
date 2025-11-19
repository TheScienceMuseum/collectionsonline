// const { Pinecone } = require('@pinecone-database/pinecone');
// const config = require('../config.js');

// const score_cutoff = 0.3;

// module.exports = async (uid, type) => {
//   try {
//     // only works for object records for now
//     if (type !== 'object') {
//       // console.log(`Skipping non-object type: ${type}`);
//       return null;
//     }
//     const related = {
//       articles: { oands: [] },
//       records: {}
//     };

//     const suid = uid.startsWith('co') ? uid.substring(2) : uid;
//     const vuid = suid + '#1'; // use first chunk of this record as the lookup vector

//     // Initialize Pinecone with error handling
//     let pc;
//     try {
//       pc = new Pinecone({ 
//         apiKey: config.pinecone 
//       });
//     } catch (initError) {
//       console.error('Failed to initialize Pinecone client:', initError.message);
//       return null;
//     }

//     // Get index with error handling
//     let index;
//     try {
//       index = pc.index("cosimilar");
//     } catch (indexError) {
//       console.error('Failed to get Pinecone index:', indexError.message);
//       return null;
//     }

//     // Execute query with comprehensive error handling
//     let queryResponse;
//     try {
//       queryResponse = await index.namespace('__default__').query({
//         id: vuid,
//         topK: 3,
//         includeValues: false,
//         filter: { 
//           type: "oands",
//         },
//         includeMetadata: true // Ensure metadata is included for fields
//       });
//       console.log(queryResponse);
//     } catch (queryError) {
//       // Handle specific Pinecone authorization errors
//       if (queryError.name === 'PineconeAuthorizationError') {
//         console.error('Pinecone authorization failed. Please check your API key and environment configuration.');
//         console.error('Ensure your Pinecone index "cosimilar" exists and is accessible.');
//         return null;
//       }
      
//       // Handle network/timeout errors
//       if (queryError.code === 'ENOTFOUND' || queryError.code === 'ETIMEDOUT') {
//         console.error('Network error connecting to Pinecone:', queryError.message);
//         return null;
//       }
      
//       // Handle index not found errors
//       if (queryError.message && queryError.message.includes('index not found')) {
//         console.error('Pinecone index "cosimilar" not found. Please check the index name.');
//         return null;
//       }
      
//       console.error('Pinecone query failed:', queryError.message);
//       return null;
//     }

//     // Validate query response structure
//     if (!queryResponse || !Array.isArray(queryResponse.matches)) {
//       console.error('Invalid query response format:', queryResponse);
//       return related; // Return empty related structure
//     }

//     queryResponse.matches.forEach((hit) => {
//       if (hit && hit.metadata && hit.score > score_cutoff) {
//         related.articles.oands.push({
//           'title': hit.metadata.title || 'Unknown Title',
//           'url': hit.metadata.url || '#'
//         });
//       } 
//     });

//     console.log(`Found ${related.articles.oands.length} related articles`);
//     console.log(related);
//     return related;

//   } catch (unexpectedError) {
//     // Catch any unexpected errors not handled above
//     console.error('Unexpected error in similarity search:', unexpectedError);
//     return null;
//   }
// };


module.exports = async (uid, type) => {

  let related = {
    articles: {
      oands: [],
      blogs: [],
      journal: [],
    },
    records: []
  };

  // related.articles.oands.push({
  //   'title': 'Title',
  //   'url': '#'
  // });

  // Add a helper properties for Handlebars
  related.hasArticles = !!(
    related.articles?.oands?.length || 
    related.articles?.blog?.length || 
    related.articles?.journal?.length
  );
  related.hasRecords = !!(
    related.records?.length
  );

  return related
}
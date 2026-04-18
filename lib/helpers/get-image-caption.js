const sortImages = require('./jsonapi-response/sort-images');

// Returns the primary image caption string from an ES record _source, or
// null if no caption is present. Mirrors the caption extraction used when
// building record-page images in lib/transforms/json-to-html-data.js so
// homepage cards carry the same caption text as the record page.
module.exports = function getImageCaption (source) {
  if (!source || !source.multimedia) return null;

  const multimedia = Array.isArray(source.multimedia) ? source.multimedia : [source.multimedia];
  if (multimedia.length === 0) return null;

  const first = sortImages(multimedia)[0];
  if (!first || !Array.isArray(first.title)) return null;

  const caption = first.title.find(t => t && t.type === 'caption');
  return (caption && caption.value) || null;
};

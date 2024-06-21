module.exports = (description, part) => {
  // for sph records that have no primary.initialDescription, make a summary from the web.initialDescription, and use the rest as moreDescription

  if (part === 'initialDescription') {
    return description.primary?.initialDescription || description.web?.initialDescription.slice(0, 1);
  } else if (part === 'moreDescription') {
    return description.primary?.initialDescription ? description.web?.initialDescription : description.web?.initialDescription.slice(1);
  }
}

module.exports = (description, part) => {
  console.log(description);
  console.log(part);
  // for sph records that have no primary.initialDescription, make a summary from the web.initialDescription, and use the rest as moreDescription
  if (description) {
    if (part === 'initialDescription') {
      return description.primary?.initialDescription || description.web?.initialDescription.slice(0, 1);
    } else if (part === 'moreDescription') {
      return description.primary?.initialDescription ? description.initialDescription : description.web?.initialDescription.slice(1);
    }
  }
};

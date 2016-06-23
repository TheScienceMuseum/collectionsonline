module.exports = (resource) => {
  const title = getTitle(resource.data);
  const type = getType(resource.data);
  const fact = getFacts(resource.data);
  const related = getRelated(resource);
  const description = getDescription(resource.data);
  const details = getDetails(resource.data);

  return {title, type, fact, related, description, details};
};

function getTitle (data) {
  return data.attributes.summary_title;
}

function getType (data) {
  return data.type;
}

function getFacts (data) {
  // Need confirmation of what attributes to use as facts
  const occupation = getOccupation(data);
  const nationality = getNationality(data);
  const born = getBorn(data);
  const birth = getBirth(data);
  const death = getDeath(data);

  return [occupation, nationality, born, birth, death].filter(el => el);
}

function getOccupation (data) {
  try {
    if (data.attributes.occupation) {
      return {key: 'Occupation', value: data.attributes.occupation};
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}

function getNationality (data) {
  try {
    if (data.attributes.nationality) {
      return {key: 'Nationality', value: data.attributes.nationality};
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}

function getBorn (data) {
  try {
    if (data.attributes.lifecycle.birth[0].location.name[0].value) {
      return {key: 'Born', value: data.attributes.lifecycle.birth[0].location.name[0].value};
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}

function getBirth (data) {
  try {
    if (data.attributes.lifecycle.birth[0].date[0].value) {
      return {key: 'Birth', value: data.attributes.lifecycle.birth[0].date[0].value};
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}

function getDeath (data) {
  try {
    if (data.attributes.lifecycle.death[0].date[0].value) {
      return {key: 'Death', value: data.attributes.lifecycle.death[0].date[0].value};
    }
  } catch (err) {
    return null;
  }
}

function getRelated (resource) {
  if (resource.data.relationships) {
    const related = resource.included.reduce((prev, curr) => {
      if (curr.type === 'people') {
        // Naive check to see if person is an actual person or an organistion
        // Would be nice to have this info available in the original resource
        if (!curr.attributes.role) {
          if (!prev.organisations) {
            prev.organisations = [];
          }
          prev.organisations.push(curr);
          return prev;
        }
      }
      if (!prev[curr.type]) {
        prev[curr.type] = [];
      }
      prev[curr.type].push(curr);
      return prev;
    }, {});
    return related;
  }
}

function getDescription (data) {
  try {
    if (data.attributes.note[0].value) {
      return data.attributes.note[0].value;
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}

function getDetails (data) {
  // Need confirmation of what attributes to use as details
  const website = getWebsite(data);
  return [website].filter(el => el);
}

function getWebsite (data) {
  try {
    if (data.attributes.website) {
      return {key: 'Website', value: data.attributes.website, link: data.attributes.website};
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}

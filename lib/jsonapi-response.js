module.exports = (data) => {
  let response = {};

  response.data = {};
  response.data.type = data._type;
  response.data.id = data._id;
  response.data.attributes = Object.assign({}, data._source);

  response.links = {};
  response.links.self = 'http://www.sciencemuseum.org.uk/' + data._type + '/' + data._id;

  return JSON.stringify(response);
};

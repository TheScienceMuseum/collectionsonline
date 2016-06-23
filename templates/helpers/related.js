const Handlebars = require('handlebars');

module.exports = (relation) => {
  const url = relation.links ? relation.links.self : '#';
  const name = relation.attributes.summary_title;
  let role;

  if (relation.attributes && relation.attributes.role) {
    role = `(${relation.attributes.role})`;
  } else {
    role = '';
  }

  return new Handlebars.SafeString(
    '<li><a href="' + url + '">' + name + '</a> ' + role + '</li>'
  );
};

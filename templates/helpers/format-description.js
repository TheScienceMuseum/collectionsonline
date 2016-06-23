const Handlebars = require('handlebars');

module.exports = (description) => {
  const splitDescription = description.split('\n');
  let initialDescription;
  let moreDescription;

  const formattedDescription = splitDescription.map((el) => {
    return '<p>' + el + '</p>';
  });

  if (formattedDescription.length > 15) {
    initialDescription = formattedDescription.slice(0, 14);
    moreDescription = `
    <div class="details" aria-expanded="false">
      <div class="details__summary">More…</div>
        <div class="details__content">
          ${formattedDescription.slice(15).join('')}
        </div>
      </div>`;

    return new Handlebars.SafeString(
      `${initialDescription.join('')}${moreDescription}`
    );
  } else {
    return new Handlebars.SafeString(formattedDescription.join(''));
  }
};

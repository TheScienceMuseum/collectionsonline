module.exports = () => ({
  method: 'GET',
  path: '/screensaver',
  config: {
    handler: function (req, reply) {
      reply.redirect('https://s3-eu-west-1.amazonaws.com/smgco-images/slideshow/index.html');
    }
  }
});

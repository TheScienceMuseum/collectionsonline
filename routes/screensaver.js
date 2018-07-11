module.exports = () => ({
  method: 'GET',
  path: '/screensaver',
  config: {
    handler: function (req, reply) {
      reply.redirect('https://smgco-images.s3-eu-west-1.amazonaws.com/slideshow/index.html');
    }
  }
});
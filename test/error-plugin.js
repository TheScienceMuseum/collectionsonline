const test = require('tape');
const errorPlugin = require('../routes/plugins/error');

test('Should only care about error responses', (t) => {
  t.plan(2);

  const mockServer = {
    ext (hook, onPreResponse) {
      if (hook === 'onPreResponse') {
        this.onPreResponse = onPreResponse;
      }
    }
  };

  errorPlugin.register(mockServer, null, () => 0);

  t.ok(mockServer.onPreResponse, 'onPreResponse hander registered');

  const mockRequest = {
    response: 'NOT AN ERROR'
  };

  const mockReply = {
    continue: () => {
      t.pass('Continue called on non error');
      t.end();
    }
  };

  mockServer.onPreResponse(mockRequest, mockReply);
});

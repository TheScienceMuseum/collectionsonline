const test = require('tape');
const Boom = require('boom');
const Sinon = require('sinon');
const errorPlugin = require('../routes/plugins/error').plugin;

test('Should only care about error responses', (t) => {
  t.plan(1);

  const mockServer = createMockServer();
  errorPlugin.register(mockServer, null, () => 0);

  t.ok(mockServer.onPreResponse, 'onPreResponse hander registered');
  t.end();
});

test('Should reply with error page for text/html accepted requests', (t) => {
  t.plan(6);

  const mockServer = createMockServer();
  errorPlugin.register(mockServer, null, () => 0);

  t.ok(mockServer.onPreResponse, 'onPreResponse hander registered');

  const errMessage = 'BOOM!';

  const mockRequest = {
    response: new Error(errMessage),
    headers: { accept: 'text/html' }
  };

  const mockReply = { view: Sinon.stub(), code: Sinon.spy() };
  mockReply.view.returns(mockReply);

  mockServer.onPreResponse(mockRequest, mockReply);

  t.ok(mockReply.view.called, 'Render function was called');
  t.equal(mockReply.view.firstCall.args[0], 'error', 'Error template was rendered');
  t.equal(mockReply.view.firstCall.args[1].error.message, errMessage, 'Error message was as expected');

  t.ok(mockReply.code.called, 'Code function was called');
  t.equal(mockReply.code.firstCall.args[0], 500, 'Status code was 500');

  t.end();
});

test('Should reply with error JSON for application/vnd.api+json accepted requests', (t) => {
  t.plan(2);

  const mockServer = createMockServer();
  errorPlugin.register(mockServer, null, () => 0);

  t.ok(mockServer.onPreResponse, 'onPreResponse hander registered');

  const errMessage = 'BOOM!';

  const mockRequest = {
    response: new Boom(500, errMessage),
    headers: { accept: 'application/vnd.api+json' }
  };

  const mockReply = {};

  mockServer.onPreResponse(mockRequest, mockReply);

  t.ok(Array.isArray(mockRequest.response.output.payload.errors), 'Output was transformed correctly');
  t.end();
});

function createMockServer() {
  return {
    ext(hook, onPreResponse) {
      if (hook === 'onPreResponse') {
        this.onPreResponse = onPreResponse;
      }
    }
  };
}

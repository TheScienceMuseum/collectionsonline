'use strict';

// /mcp — Model Context Protocol endpoint for AI agents (Copilot Studio,
// Claude connectors, Claude Code, VS Code). Stateless Streamable HTTP: every
// POST is answered by a fresh MCP server instance (lib/mcp/server.js).
//
// The SDK's handler is web-standard (Request → Response), so the Hapi
// request is bridged into a Request and the result returned as an ordinary
// Hapi response; lifecycle, timeouts and server.inject all keep working.
// Rate limiting is CloudFront WAF's job; see docs/mcp.md.

const { createMcpHandler } = require('@modelcontextprotocol/server');
const buildServer = require('../lib/mcp/server');
const { authenticate } = require('../lib/mcp/auth');

const PATH = '/mcp';
const MAX_BYTES = 64 * 1024;

// Request headers not passed to the SDK: credentials and hop-by-hop headers.
const SKIP_REQUEST_HEADERS = new Set([
  'host', 'authorization', 'x-api-key', 'cookie', 'content-length', 'connection', 'keep-alive', 'transfer-encoding'
]);
const SKIP_RESPONSE_HEADERS = new Set(['content-length', 'connection', 'keep-alive', 'transfer-encoding']);

const isOn = (v) => v === true || v === 'true';

const rpcError = (h, status, message) => h.response({
  jsonrpc: '2.0',
  error: { code: -32001, message },
  id: null
}).code(status).header('x-robots-tag', 'noindex');

module.exports = (elastic, config) => {
  const mcp = createMcpHandler(({ authInfo }) => buildServer({
    elastic,
    config,
    caller: {
      client: (authInfo && authInfo.clientId) || 'anonymous',
      tier: (authInfo && authInfo.extra && authInfo.extra.tier) || 'public'
    }
  }), {
    onerror: (error) => console.error('MCP handler error:', error.message)
  });

  const common = {
    auth: false,
    cache: { otherwise: 'no-store' }
  };

  return [
    {
      method: 'POST',
      path: PATH,
      options: {
        ...common,
        payload: { parse: false, output: 'data', maxBytes: MAX_BYTES },
        handler: async (request, h) => {
          if (!isOn(config.mcpEnabled)) return rpcError(h, 404, 'Not found');

          const caller = authenticate(request, config);
          if (!caller.ok) {
            return rpcError(h, 401, caller.message)
              .header('www-authenticate', 'Bearer realm="smg-collection"');
          }

          const headers = new Headers();
          Object.keys(request.headers).forEach((name) => {
            if (!SKIP_REQUEST_HEADERS.has(name)) headers.set(name, request.headers[name]);
          });
          const body = request.payload && request.payload.length ? request.payload : undefined;
          const webRequest = new Request(`http://${request.info.host || 'localhost'}${PATH}`, {
            method: 'POST',
            headers,
            body
          });

          const res = await mcp.fetch(webRequest, {
            authInfo: { token: '', clientId: caller.client, scopes: [caller.tier], extra: { tier: caller.tier } }
          });

          const text = await res.text();
          const response = h.response(text || null).code(res.status);
          res.headers.forEach((value, name) => {
            if (!SKIP_RESPONSE_HEADERS.has(name)) response.header(name, value);
          });
          return response.header('x-robots-tag', 'noindex');
        }
      }
    },
    {
      method: ['GET', 'DELETE'],
      path: PATH,
      options: {
        ...common,
        handler: (request, h) => {
          if (!isOn(config.mcpEnabled)) return rpcError(h, 404, 'Not found');
          return rpcError(h, 405, 'Method not allowed. This MCP server is stateless: use POST.')
            .header('allow', 'POST');
        }
      }
    }
  ];
};

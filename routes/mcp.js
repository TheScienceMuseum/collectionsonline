'use strict';

// /mcp — Model Context Protocol endpoint for AI agents (Copilot Studio,
// Claude connectors, Claude Code, VS Code). Stateless Streamable HTTP: every
// POST is answered by a fresh MCP server instance (lib/mcp/server.js).
//
// The SDK's handler is web-standard (Request → Response), so the Hapi
// request is bridged into a Request and the result returned as an ordinary
// Hapi response; lifecycle, timeouts and server.inject all keep working.
// Rate limiting is CloudFront WAF's job; see docs/mcp.md.

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
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

// Lets SDK-level errors (reported through onerror, outside our handler) be
// tied to the request they belong to. The handler decides how to log them
// once it knows the response status.
const requestContext = new AsyncLocalStorage();

// What was asked for, without credentials or body content, for error logs.
const describe = (request, caller) => {
  let rpc;
  try {
    const body = JSON.parse(String(request.payload || ''));
    rpc = (Array.isArray(body) ? body : [body]).map((m) => m && m.method).join(',');
  } catch (_) {
    rpc = 'unparseable';
  }
  return {
    client: caller && caller.client,
    rpc,
    protocol: request.headers['mcp-protocol-version'],
    contentType: request.headers['content-type'],
    accept: request.headers.accept,
    userAgent: request.headers['user-agent'],
    bytes: request.payload ? request.payload.length : 0
  };
};

// Server errors: full detail and stack trace.
const logFailure = (label, ref, details, error) => {
  console.error(JSON.stringify({ evt: 'mcp_error', label, ref, ...details, message: error && error.message }));
  if (error && error.stack) console.error(error.stack);
};

// Requests the SDK rejected as malformed (4xx): one short line, no stack, so
// a caller sending junk can't flood the logs.
const logRejection = (ref, details, error) => {
  console.warn(JSON.stringify({ evt: 'mcp_rejected', ref, ...details, message: error && error.message }));
};

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
    onerror: (error) => {
      const ctx = requestContext.getStore();
      if (ctx && !ctx.done) {
        ctx.errors.push(error);
        return;
      }
      // Reported after the response was sent: no status to judge it by.
      logFailure('sdk', ctx && ctx.ref, ctx && ctx.details, error);
    }
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

          const ref = crypto.randomUUID();
          const details = describe(request, caller);
          const ctx = { ref, details, errors: [], done: false };
          let res;
          try {
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
            res = await requestContext.run(ctx, () => mcp.fetch(webRequest, {
              authInfo: { token: '', clientId: caller.client, scopes: [caller.tier], extra: { tier: caller.tier } }
            }));
          } catch (error) {
            ctx.done = true;
            logFailure('bridge', ref, details, error);
            return rpcError(h, 500, `Internal error (ref ${ref})`);
          }

          const text = await res.text();
          ctx.done = true;
          if (res.status >= 500) {
            logFailure('response', ref, { ...details, status: res.status, body: text.slice(0, 500) }, ctx.errors[0]);
          } else if (ctx.errors.length) {
            logRejection(ref, { ...details, status: res.status }, ctx.errors[0]);
          }
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

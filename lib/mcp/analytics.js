'use strict';

// Usage reporting for MCP tool calls: one JSON log line per call (always),
// plus a GA4 Measurement Protocol event when mcpGa4MeasurementId and
// mcpGa4ApiSecret are configured, so agent traffic can be reported as its
// own KPI next to website visits. Fire-and-forget: reporting never delays or
// fails a tool call. No IP addresses or tokens are logged or sent.

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_TIMEOUT_MS = 2000;

const sendGa4 = (event, config) => {
  if (!config.mcpGa4MeasurementId || !config.mcpGa4ApiSecret || typeof fetch !== 'function') return;
  const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(config.mcpGa4MeasurementId)}` +
    `&api_secret=${encodeURIComponent(config.mcpGa4ApiSecret)}`;
  const params = {
    tool: event.tool,
    client: event.client,
    tier: event.tier,
    ok: event.ok ? 'true' : 'false',
    duration_ms: event.ms,
    traffic_source_type: 'agent',
    engagement_time_msec: 1
  };
  if (typeof event.results === 'number') params.result_count = event.results;
  if (event.q) params.search_term = String(event.q).slice(0, 100);

  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: `mcp.${event.client}`, events: [{ name: 'mcp_tool_call', params }] }),
    signal: AbortSignal.timeout(GA4_TIMEOUT_MS)
  }).catch((error) => {
    console.warn('MCP GA4 event failed:', error.message);
  });
};

/**
 * @param {Object} event - { tool, client, tier, ok, ms, results, q }
 * @param {Object} config
 */
const track = (event, config) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify({ evt: 'mcp_tool', ...event, q: event.q ? String(event.q).slice(0, 100) : undefined }));
  }
  sendGa4(event, config);
};

module.exports = { track };

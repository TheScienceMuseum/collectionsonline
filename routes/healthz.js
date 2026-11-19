// Load balancer health check. Answers "is this Node process accepting and
// serving requests?" and nothing more: no Elasticsearch, Redis or DynamoDB.
//
// The ELB used to check `/`, whose homepage widgets made ~55 Elasticsearch
// queries per hit, so a CIIM slowdown marked every instance unhealthy at once
// (outage of 19 Nov 2026). Those dependencies are shared by all instances —
// taking an instance out of service can't fix them — so only a stuck process
// should fail this check.
//
// Point the EB environment's default process at this path:
// Configuration → Instance traffic and scaling → Processes → default →
// Health check path.
module.exports = () => ({
  method: 'GET',
  path: '/healthz',
  config: {
    handler: function (request, h) {
      return h.response('ok')
        .type('text/plain')
        .header('cache-control', 'no-store');
    }
  }
});

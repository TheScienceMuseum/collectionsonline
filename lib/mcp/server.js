'use strict';

// Builds the MCP server for one request (the transport is stateless). Tools
// are registered per caller tier so internal-only tools can be added later
// without changing the public surface; today both tiers get the same six.

const { McpServer } = require('@modelcontextprotocol/server');
const { ToolError } = require('./errors');
const analytics = require('./analytics');
const pkg = require('../../package.json');

const TOOLS = [
  require('./tools/collection-overview'),
  require('./tools/search-collection'),
  require('./tools/get-record'),
  require('./tools/get-hierarchy'),
  require('./tools/count-records'),
  require('./tools/breakdown-records')
];

const INSTRUCTIONS = `Science Museum Group collection: the public online catalogue of the Science Museum, National Railway Museum, Science and Industry Museum, National Science and Media Museum and Locomotion — about 430,000 objects, 80,000 archive records and 25,000 people and organisations. Only information published on collection.sciencemuseumgroup.org.uk is available.

- get_collection_overview: totals, museums, galleries, licences and definitions. A good first call.
- search_collection: find records by free text and/or filters; sort=most_viewed for the most popular.
- get_record: full details of one record, including its parts and what it belongs to.
- get_hierarchy: parts of objects, group members, and archive arrangement (fonds → series → file → item).
- count_records / breakdown_records: exact numbers ("how many…", "how many per…", "top N…").

Filter values must match catalogue values exactly (case is ignored). When unsure of a value (a maker, gallery, category…), call breakdown_records with group_by and match to find it first. Component parts of objects are excluded from counts and search unless include_component_parts=true. Always link to records with the url field when citing them.`;

const toResult = (result) => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  structuredContent: result
});

const resultCount = (result) => {
  if (!result || typeof result !== 'object') return undefined;
  if (typeof result.total === 'number') return result.total;
  if (typeof result.total_records === 'number') return result.total_records;
  return undefined;
};

/**
 * @param {Object} ctx - { elastic, config, caller: { client, tier } }
 */
module.exports = ({ elastic, config, caller }) => {
  const server = new McpServer(
    { name: 'smg-collection', title: 'Science Museum Group Collection', version: pkg.version },
    { instructions: INSTRUCTIONS }
  );

  TOOLS
    .filter((tool) => !tool.tiers || tool.tiers.includes(caller.tier))
    .forEach((tool) => {
      server.registerTool(tool.name, tool.config, async (args) => {
        const started = Date.now();
        let ok = true;
        let result;
        try {
          result = await tool.handler(args || {}, { elastic, config, caller });
          return toResult(result);
        } catch (error) {
          ok = false;
          if (!(error instanceof ToolError)) console.error('MCP tool failed:', tool.name, error);
          const message = error instanceof ToolError
            ? error.message
            : 'Something went wrong answering that. Please retry, or try a simpler question.';
          return { content: [{ type: 'text', text: message }], isError: true };
        } finally {
          analytics.track({
            tool: tool.name,
            client: caller.client,
            tier: caller.tier,
            ok,
            ms: Date.now() - started,
            results: resultCount(result),
            q: args && args.q
          }, config);
        }
      });
    });

  return server;
};

module.exports.TOOLS = TOOLS;
module.exports.INSTRUCTIONS = INSTRUCTIONS;

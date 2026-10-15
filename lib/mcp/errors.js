'use strict';

// An error whose message is safe to show to the calling agent. Anything else
// thrown inside a tool is logged server-side and replaced with a generic
// message, so ES internals never reach the model.
class ToolError extends Error {
  constructor (message) {
    super(message);
    this.name = 'ToolError';
  }
}

module.exports = { ToolError };

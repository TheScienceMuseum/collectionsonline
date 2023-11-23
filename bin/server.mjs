import { Client } from '@elastic/elasticsearch';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const config = require('../config');
const createServer = require('../server');

const elastic = new Client(config.elasticsearch);

// Allow PORT env variable to specify port
config.port = process.env.PORT || config.port;

createServer(elastic, config, async (err, ctx) => {
  if (err) {
    throw err;
  }

  try {
    await ctx.server.start();
    console.log(ctx.server.info.uri);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

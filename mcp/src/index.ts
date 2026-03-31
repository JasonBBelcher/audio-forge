import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { getDb, closeDb } from './db.js';
import { registerResources } from './resources.js';
import { registerLibraryTools } from './tools-library.js';
import { registerProcessingTools } from './tools-processing.js';
import { registerPrompts } from './prompts.js';

async function main() {
  // Verify database connection
  const db = getDb();
  const assetCount = (db.prepare('SELECT COUNT(*) as count FROM assets WHERE deleted_at IS NULL').get() as { count: number }).count;
  process.stderr.write(`Database connected: ${assetCount} assets found\n`);

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all MCP handlers
  registerResources(server);
  registerLibraryTools(server);
  registerProcessingTools(server);
  registerPrompts(server);

  // Graceful shutdown
  process.on('SIGINT', () => { closeDb(); process.exit(0); });
  process.on('SIGTERM', () => { closeDb(); process.exit(0); });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_NAME} v${SERVER_VERSION} started (${assetCount} assets)\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});

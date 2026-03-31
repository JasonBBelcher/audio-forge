import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { getDb, closeDb } from './db.js';
import { registerResources } from './resources.js';
import { registerLibraryTools } from './tools-library.js';
import { registerProcessingTools } from './tools-processing.js';
import { registerDiscoveryTools } from './tools-discovery.js';
import { registerPrompts } from './prompts.js';

async function main() {
  // Initialize database with schema if needed
  let assetCount = 0;
  try {
    const db = getDb();
    assetCount = (db.prepare('SELECT COUNT(*) as count FROM assets WHERE deleted_at IS NULL').get() as { count: number }).count;
    if (assetCount === 0) {
      process.stderr.write(`✅ Database initialized at: ${process.env.HOME}/Library/Application Support/audioforge/audioforge.db\n`);
      process.stderr.write(`   Ready to import audio assets. Use import_file tool or run AudioForge app.\n`);
    } else {
      process.stderr.write(`✅ Database connected: ${assetCount} assets found\n`);
    }
  } catch (err) {
    process.stderr.write(`❌ Fatal: Could not initialize database\n`);
    process.stderr.write(`   Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all MCP handlers
  registerResources(server);
  registerLibraryTools(server);
  registerProcessingTools(server);
  await registerDiscoveryTools(server);
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

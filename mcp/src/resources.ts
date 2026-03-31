import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { URI_SCHEME } from './constants.js';
import { listAssets, getAssetById } from './queries/assets.js';
import { listCollections, getCollectionAssets } from './queries/collections.js';
import { listProjects, getProjectById } from './queries/projects.js';
import { which } from './utils/process-runner.js';

export function registerResources(server: McpServer): void {
  // Library index
  server.resource(`${URI_SCHEME}://library`, `${URI_SCHEME}://library`, async () => ({
    contents: [{
      uri: `${URI_SCHEME}://library`,
      text: JSON.stringify(listAssets().map((a) => ({
        id: a.id, name: a.name, file_type: a.file_type,
        bpm: a.bpm, key: a.key, duration: a.duration, tags: a.tags,
      })), null, 2),
      mimeType: 'application/json',
    }],
  }));

  // Single asset
  server.resource(`${URI_SCHEME}://asset/{id}`, `${URI_SCHEME}://asset/{id}`, async (uri) => {
    const id = parseInt(uri.pathname.split('/').pop() ?? '');
    const asset = getAssetById(id);
    if (!asset) throw new Error(`Asset ${id} not found`);
    return { contents: [{ uri: uri.href, text: JSON.stringify(asset, null, 2), mimeType: 'application/json' }] };
  });

  // Collections
  server.resource(`${URI_SCHEME}://collections`, `${URI_SCHEME}://collections`, async () => ({
    contents: [{
      uri: `${URI_SCHEME}://collections`,
      text: JSON.stringify(listCollections(), null, 2),
      mimeType: 'application/json',
    }],
  }));

  // Projects
  server.resource(`${URI_SCHEME}://projects`, `${URI_SCHEME}://projects`, async () => ({
    contents: [{
      uri: `${URI_SCHEME}://projects`,
      text: JSON.stringify(listProjects(), null, 2),
      mimeType: 'application/json',
    }],
  }));

  // Health check
  server.resource(`${URI_SCHEME}://health`, `${URI_SCHEME}://health`, async () => {
    const [ffmpeg, aubio, demucs, basicPitch] = await Promise.all([
      which('ffmpeg'), which('aubio'), which('demucs'), which('basic-pitch'),
    ]);
    return { contents: [{
      uri: `${URI_SCHEME}://health`,
      text: JSON.stringify({ ffmpeg, aubio, demucs, basic_pitch: basicPitch }, null, 2),
      mimeType: 'application/json',
    }] };
  });
}

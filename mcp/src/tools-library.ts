import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listAssets, getAssetById, filterAssets, updateAssetTags, softDeleteAsset, insertAsset } from './queries/assets.js';
import { buildSearchIndex, searchAssets } from './search.js';
import { analyzeBpm } from './analysis/bpm.js';
import { analyzeKey } from './analysis/key-detect.js';
import { getAudioMetadata } from './analysis/metadata.js';
import { getDb } from './db.js';
import { statSync } from 'fs';

export function registerLibraryTools(server: McpServer): void {
  server.tool('search_library',
    { query: z.string().min(2).max(200), limit: z.number().min(1).max(50).optional() },
    async ({ query, limit }) => {
      buildSearchIndex(listAssets());
      const results = searchAssets(query, limit ?? 10);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool('filter_assets',
    {
      bpm_min: z.number().optional(), bpm_max: z.number().optional(),
      key: z.string().optional(), file_type: z.string().optional(),
      role: z.string().optional(), source: z.string().optional(),
      tags: z.string().optional(),
    },
    async (filters) => {
      const results = filterAssets(filters);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results.map((a) => ({
        id: a.id, name: a.name, bpm: a.bpm, key: a.key, file_type: a.file_type, tags: a.tags,
      })), null, 2) }] };
    }
  );

  server.tool('get_asset', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id);
    if (!asset) return { content: [{ type: 'text' as const, text: `Asset ${id} not found` }], isError: true };
    return { content: [{ type: 'text' as const, text: JSON.stringify(asset, null, 2) }] };
  });

  server.tool('update_tags', { id: z.number(), tags: z.string() }, async ({ id, tags }) => {
    updateAssetTags(id, tags);
    return { content: [{ type: 'text' as const, text: `Tags updated for asset ${id}` }] };
  });

  server.tool('delete_asset', { id: z.number() }, async ({ id }) => {
    softDeleteAsset(id);
    return { content: [{ type: 'text' as const, text: `Asset ${id} moved to trash` }] };
  });

  server.tool('analyze_bpm', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id);
    if (!asset) return { content: [{ type: 'text' as const, text: `Asset ${id} not found` }], isError: true };
    const bpm = await analyzeBpm(asset.file_path);
    if (bpm) getDb().prepare('UPDATE assets SET bpm = ? WHERE id = ?').run(bpm, id);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ id, bpm }) }] };
  });

  server.tool('analyze_key', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id);
    if (!asset) return { content: [{ type: 'text' as const, text: `Asset ${id} not found` }], isError: true };
    const key = await analyzeKey(asset.file_path);
    if (key) getDb().prepare('UPDATE assets SET key = ? WHERE id = ?').run(key, id);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ id, key }) }] };
  });

  server.tool('analyze_audio', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id);
    if (!asset) return { content: [{ type: 'text' as const, text: `Asset ${id} not found` }], isError: true };
    const [bpm, key, metadata] = await Promise.all([
      analyzeBpm(asset.file_path), analyzeKey(asset.file_path), getAudioMetadata(asset.file_path),
    ]);
    const db = getDb();
    db.prepare('UPDATE assets SET bpm = ?, key = ?, duration = ?, sample_rate = ?, channels = ?, analyzed_at = datetime(\'now\') WHERE id = ?')
      .run(bpm, key, metadata.duration, metadata.sample_rate, metadata.channels, id);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ id, bpm, key, ...metadata }) }] };
  });

  server.tool('get_metadata', { file_path: z.string() }, async ({ file_path }) => {
    const metadata = await getAudioMetadata(file_path);
    return { content: [{ type: 'text' as const, text: JSON.stringify(metadata, null, 2) }] };
  });
}

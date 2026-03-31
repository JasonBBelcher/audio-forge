import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DiscoveryService } from './discovery/discovery-service.js';
import {
  getDiscoveryById,
  listDiscoveries,
  getFavorites,
  toggleFavorite,
  updateNotes,
  deleteDiscovery,
} from './queries/discoveries.js';
import { filterAssets } from './queries/assets.js';
import { getCamelotCode, getCompatibleKeys } from './utils/camelot.js';

const discoveryService = new DiscoveryService();

// Schemas
const DiscoveryFiltersSchema = z.object({
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  yearMin: z.number().optional(),
  yearMax: z.number().optional(),
  bpmMin: z.number().optional(),
  bpmMax: z.number().optional(),
  key: z.string().optional(),
  maxViews: z.number().optional(),
  minViews: z.number().optional(),
  minDuration: z.number().optional(),
  maxDuration: z.number().optional(),
});

export async function registerDiscoveryTools(server: McpServer): Promise<void> {
  // discovery_roll
  server.tool(
    'discovery_roll',
    'Roll the dice — get a random obscure YouTube music discovery',
    {
      filters: z
        .object({
          genres: z.array(z.string()).optional().describe('Genre focus (e.g., ["funk", "soul"])'),
          regions: z.array(z.string()).optional().describe('Geographic region (e.g., ["japanese", "brazilian"])'),
          yearMin: z.number().optional().describe('Earliest year'),
          yearMax: z.number().optional().describe('Latest year'),
          bpmMin: z.number().optional().describe('Minimum BPM'),
          bpmMax: z.number().optional().describe('Maximum BPM'),
          key: z.string().optional().describe('Musical key (e.g., "Am")'),
          maxViews: z.number().optional().describe('Maximum view count for obscurity'),
          minViews: z.number().optional().describe('Minimum view count'),
          minDuration: z.number().optional().describe('Minimum duration in seconds'),
          maxDuration: z.number().optional().describe('Maximum duration in seconds'),
        })
        .optional()
        .describe('Discovery filters'),
    },
    async (params) => {
      try {
        const result = await discoveryService.rollDice(params.filters);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_search
  server.tool(
    'discovery_search',
    'Search for YouTube music with a custom query and filters',
    {
      query: z.string().describe('Search query (e.g., "rare japanese funk")'),
      filters: z.object({
        maxViews: z.number().optional(),
        minViews: z.number().optional(),
        minDuration: z.number().optional(),
        maxDuration: z.number().optional(),
      }).optional(),
      limit: z.number().optional().describe('Max results (default 20)'),
    },
    async (params) => {
      try {
        const results = await discoveryService.search(params.query, params.filters, params.limit ?? 20);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_batch
  server.tool(
    'discovery_batch',
    'Process multiple YouTube URLs at once',
    {
      urls: z.array(z.string()).describe('YouTube URLs to process'),
    },
    async (params) => {
      try {
        const results = await discoveryService.batchProcess(params.urls);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_info
  server.tool(
    'discovery_info',
    'Get enriched information for a YouTube URL',
    {
      url: z.string().describe('YouTube URL'),
    },
    async (params) => {
      try {
        const result = await discoveryService.processUrl(params.url);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_history
  server.tool(
    'discovery_history',
    'View recent discoveries',
    {
      limit: z.number().optional().describe('Number of items (default 100)'),
    },
    async (params) => {
      const history = listDiscoveries(params.limit ?? 100);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(history, null, 2),
          },
        ],
      };
    }
  );

  // discovery_favorites
  server.tool(
    'discovery_favorites',
    'List all favorited discoveries',
    {},
    async () => {
      const favorites = getFavorites();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(favorites, null, 2),
          },
        ],
      };
    }
  );

  // discovery_toggle_favorite
  server.tool(
    'discovery_toggle_favorite',
    'Favorite or unfavorite a discovery',
    {
      discovery_id: z.number().describe('Discovery ID'),
    },
    async (params) => {
      try {
        const isFavorite = toggleFavorite(params.discovery_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ id: params.discovery_id, is_favorite: isFavorite }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_add_note
  server.tool(
    'discovery_add_note',
    'Add sampling notes to a discovery',
    {
      discovery_id: z.number().describe('Discovery ID'),
      notes: z.string().describe('Notes about the track'),
    },
    async (params) => {
      try {
        updateNotes(params.discovery_id, params.notes);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ id: params.discovery_id, notes: params.notes }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_find_compatible
  server.tool(
    'discovery_find_compatible',
    'Find harmonically compatible discoveries by Camelot wheel',
    {
      discovery_id: z.number().describe('Discovery ID'),
      compatibility_type: z
        .enum(['perfect', 'adjacent', 'relative', 'energy_boost'])
        .optional()
        .describe('Type of compatibility'),
    },
    async (params) => {
      try {
        const discovery = getDiscoveryById(params.discovery_id);
        if (!discovery || !discovery.key) {
          return {
            content: [
              {
                type: 'text',
                text: 'Discovery not found or key not analyzed',
              },
            ],
            isError: true,
          };
        }

        const camelotCode = getCamelotCode(discovery.key);
        if (!camelotCode) {
          return {
            content: [
              {
                type: 'text',
                text: `Cannot determine Camelot code for key: ${discovery.key}`,
              },
            ],
            isError: true,
          };
        }

        const compatibleKeys = getCompatibleKeys(camelotCode);
        const assets = filterAssets({ key: discovery.key, bpm_min: discovery.bpm ? discovery.bpm - 5 : undefined, bpm_max: discovery.bpm ? discovery.bpm + 5 : undefined });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  source: discovery,
                  camelot_code: camelotCode,
                  compatible_keys: compatibleKeys,
                  compatible_assets_count: assets.length,
                  assets: assets.slice(0, 10), // Top 10
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_create_playlist
  server.tool(
    'discovery_create_playlist',
    'Create a discovery playlist',
    {
      name: z.string().describe('Playlist name'),
      description: z.string().optional().describe('Playlist description'),
    },
    async (params) => {
      try {
        const id = discoveryService.createPlaylistItem(params.name, params.description);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ id, name: params.name, description: params.description }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_add_to_playlist
  server.tool(
    'discovery_add_to_playlist',
    'Add a discovery to a playlist',
    {
      playlist_id: z.number().describe('Playlist ID'),
      discovery_id: z.number().describe('Discovery ID'),
    },
    async (params) => {
      try {
        discoveryService.addToPlaylistItem(params.playlist_id, params.discovery_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ playlist_id: params.playlist_id, discovery_id: params.discovery_id }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_get_playlist
  server.tool(
    'discovery_get_playlist',
    'Get all discoveries in a playlist',
    {
      playlist_id: z.number().describe('Playlist ID'),
    },
    async (params) => {
      try {
        const items = discoveryService.getPlaylistItemslist(params.playlist_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(items, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_list_playlists
  server.tool(
    'discovery_list_playlists',
    'List all discovery playlists',
    {},
    async () => {
      try {
        const playlists = discoveryService.listPlaylistsAll();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(playlists, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_save_preset
  server.tool(
    'discovery_save_preset',
    'Save a filter preset for quick discovery',
    {
      name: z.string().describe('Preset name'),
      filters: DiscoveryFiltersSchema.describe('Filter configuration'),
    },
    async (params) => {
      try {
        const id = discoveryService.savePresetItem(params.name, params.filters);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ id, name: params.name, filters: params.filters }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // discovery_load_preset
  server.tool(
    'discovery_load_preset',
    'Load a saved filter preset',
    {
      name: z.string().describe('Preset name'),
    },
    async (params) => {
      try {
        const filters = discoveryService.loadPresetItem(params.name);
        if (!filters) {
          return {
            content: [
              {
                type: 'text',
                text: `Preset not found: ${params.name}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ name: params.name, filters }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

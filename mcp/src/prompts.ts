import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAssetById, listAssets } from './queries/assets.js';
import { getProjectById } from './queries/projects.js';
import { getCompatibleKeys } from './utils/camelot.js';

export function registerPrompts(server: McpServer): void {
  server.prompt('project_context', { project_id: z.string() }, async ({ project_id }) => {
    const project = getProjectById(parseInt(project_id));
    if (!project) return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'Project not found' } }] };

    return { messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `You are working on the AudioForge project "${project.name}".

Project details:
- BPM: ${project.bpm ?? 'Not set'}
- Key: ${project.key ?? 'Not set'}
- Time Signature: ${project.time_signature ?? '4/4'}
- Description: ${project.description ?? 'None'}

Use the AudioForge MCP tools to search, analyze, and process audio assets for this project.`,
      },
    }] };
  });

  server.prompt('mixing_assistant', { asset_id: z.string() }, async ({ asset_id }) => {
    const asset = getAssetById(parseInt(asset_id));
    if (!asset) return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'Asset not found' } }] };

    const compatKeys = asset.key ? getCompatibleKeys(asset.key) : [];

    return { messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Help me find tracks that mix well with "${asset.name}".

Current track:
- BPM: ${asset.bpm ?? 'Unknown'}
- Key: ${asset.key ?? 'Unknown'}
- File type: ${asset.file_type}

Compatible keys for mixing:
${compatKeys.map((c) => `- ${c.key} (${c.camelot}) — ${c.type}`).join('\n')}

Use the find_compatible_assets tool to search the library, and suggest a mixing order.`,
      },
    }] };
  });

  server.prompt('production_workflow', { goal: z.string() }, async ({ goal }) => {
    const assetCount = listAssets().length;

    return { messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `I need help with an audio production task: "${goal}"

My AudioForge library has ${assetCount} assets.

Available capabilities:
- Search and filter the library by BPM, key, type, tags
- Analyze audio (BPM, key, loudness, metadata)
- Process audio (trim, normalize, fade, reverse, pitch shift, time stretch)
- Separate stems (vocals, drums, bass, other)
- Convert audio to MIDI
- Generate audio from text prompts
- Master audio (EQ, compression, loudness normalization)
- Detect and extract loops
- Export to hardware (SP-404 MK2, Koala Sampler)
- Download from YouTube

Plan and execute the steps needed to accomplish this goal.`,
      },
    }] };
  });

  server.prompt('asset_analysis', { asset_id: z.string() }, async ({ asset_id }) => {
    const asset = getAssetById(parseInt(asset_id));
    if (!asset) return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'Asset not found' } }] };

    return { messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Provide a detailed analysis of audio asset "${asset.name}".

Current metadata:
- File: ${asset.file_path}
- Format: ${asset.file_type}
- Duration: ${asset.duration ?? 'Unknown'}s
- Sample Rate: ${asset.sample_rate ?? 'Unknown'}Hz
- Channels: ${asset.channels ?? 'Unknown'}
- BPM: ${asset.bpm ?? 'Not analyzed'}
- Key: ${asset.key ?? 'Not analyzed'}
- Tags: ${asset.tags ?? 'None'}

If BPM or key are missing, use the analyze_audio tool to detect them.
Then use analyze_loudness to measure LUFS and dynamic range.
Provide recommendations for processing (normalization, mastering, etc.).`,
      },
    }] };
  });
}

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

  server.prompt('crate_digger', { mood: z.string().optional(), genre: z.string().optional(), era: z.string().optional(), purpose: z.string().optional() }, async (args) => {
    const { mood = 'obscure', genre, era, purpose = 'sampling' } = args;

    return { messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `You are a digital crate digger on a sampling mission.

Mission parameters:
- Mood/Vibe: ${mood}
- Genre: ${genre ?? 'Any'}
- Era: ${era ?? 'Any'}
- Purpose: ${purpose}

Use discovery_roll with strategic filters to find obscure, interesting samples.
For each discovery:
1. Check if it has BPM/key metadata (analyze_audio if needed)
2. Find harmonically compatible tracks using discovery_find_compatible
3. Suggest sampling ideas and chop points
4. Save favorites and organize into playlists

Think like a producer — what makes a sample special? Rare synths, unique drums, interesting vocal textures, unexpected chord progressions.

Start rolling! Use discovery_roll multiple times to explore different areas of the musical landscape.`,
      },
    }] };
  });

  server.prompt('sample_analyst', { discovery_id: z.string() }, async ({ discovery_id }) => {
    return { messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Analyze discovery ID ${discovery_id} for sampling potential.

Use discovery tools to:
1. Get full details of the track
2. If not analyzed, run audio analysis (BPM, key detection)
3. Find compatible harmonically
4. Suggest breakdown points for chopping/looping
5. Identify interesting elements to isolate (stems separation if needed)
6. Rate the sample quality for beatmaking/production
7. Provide storage and organization recommendations

Focus on sampling potential — what makes this track usable in a beat?`,
      },
    }] };
  });
}

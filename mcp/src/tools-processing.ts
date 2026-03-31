import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAssetById, insertAsset, listAssets } from './queries/assets.js';
import { convertFormat } from './processing/convert.js';
import { trimAudio, normalizeAudio, applyFade, reverseAudio, pitchShift, timeStretch, removeSilence } from './processing/effects.js';
import { masterAudio, analyzeLoudness } from './processing/mastering.js';
import { separateStems } from './processing/stems.js';
import { audioToMidi } from './processing/audio-to-midi.js';
import { generateAudio, isModelInstalled } from './processing/generation.js';
import { detectLoops, extractLoop } from './processing/loops.js';
import { getCompatibleKeys } from './utils/camelot.js';
import { downloadAudio, getVideoInfo } from './utils/youtube.js';
import { exportKit, detectSDCards } from './hardware/sp404.js';
import { exportKoalaKit } from './hardware/koala.js';
import { exportEmx1ToMidi } from './hardware/emx1.js';
import { addWatchFolder, removeWatchFolder, listWatchFolders } from './utils/watcher.js';
import { createCollection, addAssetToCollection, removeAssetFromCollection } from './queries/collections.js';
import { createProject, updateProject } from './queries/projects.js';
import { statSync } from 'fs';
import { basename, extname } from 'path';

export function registerProcessingTools(server: McpServer): void {
  // --- Audio Processing ---

  server.tool('convert_format',
    { id: z.number(), format: z.enum(['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a', 'aac']) },
    async ({ id, format }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: `Asset ${id} not found` }], isError: true };
      const outputPath = await convertFormat(asset.file_path, format);
      const newId = insertAsset({ name: `${asset.name} (${format})`, file_path: outputPath, file_type: format, file_size: statSync(outputPath).size });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ id: newId, path: outputPath }) }] };
    }
  );

  server.tool('trim_audio',
    { id: z.number(), start: z.number(), end: z.number() },
    async ({ id, start, end }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await trimAudio(asset.file_path, start, end);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  server.tool('normalize_audio',
    { id: z.number(), target_lufs: z.number().optional() },
    async ({ id, target_lufs }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await normalizeAudio(asset.file_path, target_lufs);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  server.tool('apply_fade',
    { id: z.number(), fade_in: z.number().optional(), fade_out: z.number().optional() },
    async ({ id, fade_in, fade_out }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await applyFade(asset.file_path, fade_in, fade_out);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  server.tool('reverse_audio',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await reverseAudio(asset.file_path);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  server.tool('pitch_shift',
    { id: z.number(), semitones: z.number().min(-24).max(24) },
    async ({ id, semitones }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await pitchShift(asset.file_path, semitones);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  server.tool('time_stretch',
    { id: z.number(), rate: z.number().min(0.25).max(4) },
    async ({ id, rate }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await timeStretch(asset.file_path, rate);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  server.tool('remove_silence',
    { id: z.number(), threshold_db: z.number().optional() },
    async ({ id, threshold_db }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await removeSilence(asset.file_path, threshold_db);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  // --- Mastering ---

  server.tool('master_audio',
    {
      id: z.number(), eq_low_gain: z.number().optional(), eq_mid_gain: z.number().optional(),
      eq_high_gain: z.number().optional(), comp_threshold: z.number().optional(),
      comp_ratio: z.number().optional(), target_lufs: z.number().optional(),
    },
    async ({ id, eq_low_gain, eq_mid_gain, eq_high_gain, comp_threshold, comp_ratio, target_lufs }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const params = { eq_low_gain, eq_mid_gain, eq_high_gain, comp_threshold, comp_ratio, target_lufs };
      const out = await masterAudio(asset.file_path, params);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  server.tool('analyze_loudness',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const result = await analyzeLoudness(asset.file_path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Advanced Processing ---

  server.tool('separate_stems',
    { id: z.number(), model: z.enum(['htdemucs', 'htdemucs_ft']).optional() },
    async ({ id, model }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const stems = await separateStems(asset.file_path, model);
      // Import each stem as a new asset
      for (const [role, path] of Object.entries(stems)) {
        insertAsset({ name: `${asset.name} (${role})`, file_path: path as string, file_type: 'wav', role, source: 'stem-separation' });
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(stems) }] };
    }
  );

  server.tool('audio_to_midi',
    { id: z.number(), onset_threshold: z.number().optional(), frame_threshold: z.number().optional() },
    async ({ id, onset_threshold, frame_threshold }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const result = await audioToMidi(asset.file_path, { onset_threshold, frame_threshold });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool('generate_audio',
    { prompt: z.string().min(3).max(500), duration: z.number().optional(), seed: z.number().optional() },
    async ({ prompt, duration, seed }) => {
      const installed = await isModelInstalled();
      if (!installed) return { content: [{ type: 'text' as const, text: 'Stable Audio model not installed' }], isError: true };
      const path = await generateAudio({ prompt, duration, seed });
      const name = basename(path, extname(path));
      insertAsset({ name, file_path: path, file_type: 'wav', source: 'generated' });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path }) }] };
    }
  );

  server.tool('detect_loops',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const loops = await detectLoops(asset.file_path, asset.bpm ?? undefined);
      return { content: [{ type: 'text' as const, text: JSON.stringify(loops, null, 2) }] };
    }
  );

  server.tool('extract_loop',
    { id: z.number(), start: z.number(), end: z.number() },
    async ({ id, start, end }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text' as const, text: 'Not found' }], isError: true };
      const out = await extractLoop(asset.file_path, start, end);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path: out }) }] };
    }
  );

  // --- Harmonic Mixing ---

  server.tool('get_compatible_keys',
    { key: z.string() },
    async ({ key }) => {
      const results = getCompatibleKeys(key);
      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool('find_compatible_assets',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset?.key) return { content: [{ type: 'text' as const, text: 'Asset has no key detected' }], isError: true };
      const compatKeys = getCompatibleKeys(asset.key).map((c) => c.key);
      const allAssets = listAssets().filter((a) => a.key && compatKeys.includes(a.key) && a.id !== id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(allAssets.map((a) => ({
        id: a.id, name: a.name, key: a.key, bpm: a.bpm,
      })), null, 2) }] };
    }
  );

  // --- YouTube ---

  server.tool('youtube_info',
    { url: z.string().url() },
    async ({ url }) => {
      const info = await getVideoInfo(url);
      return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
    }
  );

  server.tool('youtube_download',
    { url: z.string().url(), format: z.enum(['wav', 'mp3', 'flac']).optional() },
    async ({ url, format }) => {
      const path = await downloadAudio(url, format ?? 'wav');
      const name = basename(path, extname(path));
      insertAsset({ name, file_path: path, file_type: format ?? 'wav', source: 'youtube' });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path }) }] };
    }
  );

  // --- Hardware ---

  server.tool('sp404_export_kit',
    {
      sd_card_path: z.string(), bank: z.string(),
      pads: z.array(z.object({ pad: z.number().min(0).max(15), asset_id: z.number() })),
    },
    async ({ sd_card_path, bank, pads }) => {
      const assignments = pads.map((p) => {
        const asset = getAssetById(p.asset_id);
        if (!asset) throw new Error(`Asset ${p.asset_id} not found`);
        return { pad: p.pad, asset_path: asset.file_path };
      });
      const exported = await exportKit(sd_card_path, bank, assignments);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ exported }) }] };
    }
  );

  server.tool('sp404_detect_sd',
    {},
    async () => {
      const cards = detectSDCards();
      return { content: [{ type: 'text' as const, text: JSON.stringify({ sd_cards: cards }) }] };
    }
  );

  server.tool('koala_export_kit',
    {
      name: z.string(), pads: z.array(z.object({ pad: z.number().min(0).max(63), asset_id: z.number() })),
    },
    async ({ name, pads }) => {
      const assignments = pads.map((p) => {
        const asset = getAssetById(p.asset_id);
        if (!asset) throw new Error(`Asset ${p.asset_id} not found`);
        return { pad: p.pad, asset_path: asset.file_path };
      });
      const kitDir = await exportKoalaKit(name, assignments);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ kit_dir: kitDir }) }] };
    }
  );

  server.tool('emx1_export_midi',
    {
      name: z.string(), bpm: z.number(),
      steps: z.array(z.object({ part: z.number(), step: z.number(), velocity: z.number() })),
    },
    async ({ name, bpm, steps }) => {
      const path = exportEmx1ToMidi({ name, bpm, steps });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ path }) }] };
    }
  );

  // --- Collections ---

  server.tool('create_collection',
    { name: z.string(), description: z.string().optional() },
    async ({ name, description }) => {
      const id = createCollection(name, description);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ id, name }) }] };
    }
  );

  server.tool('add_to_collection',
    { collection_id: z.number(), asset_id: z.number() },
    async ({ collection_id, asset_id }) => {
      addAssetToCollection(collection_id, asset_id);
      return { content: [{ type: 'text' as const, text: `Asset ${asset_id} added to collection ${collection_id}` }] };
    }
  );

  server.tool('remove_from_collection',
    { collection_id: z.number(), asset_id: z.number() },
    async ({ collection_id, asset_id }) => {
      removeAssetFromCollection(collection_id, asset_id);
      return { content: [{ type: 'text' as const, text: `Asset ${asset_id} removed from collection ${collection_id}` }] };
    }
  );

  // --- Projects ---

  server.tool('create_project',
    { name: z.string(), bpm: z.number().optional(), key: z.string().optional(), description: z.string().optional() },
    async ({ name, bpm, key, description }) => {
      const id = createProject({ name, bpm, key, description });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ id, name, bpm, key, description }) }] };
    }
  );

  server.tool('update_project',
    { id: z.number(), name: z.string().optional(), bpm: z.number().optional(), key: z.string().optional(), description: z.string().optional() },
    async ({ id, name, bpm, key, description }) => {
      updateProject(id, { name, bpm, key, description } as Record<string, string | number | undefined>);
      return { content: [{ type: 'text' as const, text: `Project ${id} updated` }] };
    }
  );

  // --- Watch Folders ---

  server.tool('add_watch_folder',
    { path: z.string() },
    async ({ path }) => {
      addWatchFolder(path, (filePath) => { process.stderr.write(`New file detected: ${filePath}\n`); });
      return { content: [{ type: 'text' as const, text: `Now watching: ${path}` }] };
    }
  );

  server.tool('remove_watch_folder',
    { path: z.string() },
    async ({ path }) => {
      removeWatchFolder(path);
      return { content: [{ type: 'text' as const, text: `Stopped watching: ${path}` }] };
    }
  );

  server.tool('list_watch_folders',
    {},
    async () => {
      return { content: [{ type: 'text' as const, text: JSON.stringify(listWatchFolders()) }] };
    }
  );
}

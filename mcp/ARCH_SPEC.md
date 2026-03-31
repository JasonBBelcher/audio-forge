# AudioForge MCP Server — Architecture Specification

> **Version**: 1.0.0
> **Date**: 2026-03-30
> **Target runtime**: Node.js 20+, TypeScript 5.7, ES2020
> **MCP SDK**: @modelcontextprotocol/sdk ^1.12.0
> **Transport**: stdio (local Claude integration)

---

## 1. Purpose

Expose AudioForge's full audio production capabilities — library management, audio analysis, processing, stem separation, AI generation, hardware integration, and more — as an MCP server that Claude agents can invoke via tools, resources, and prompts.

**Design Goals**:
- Standalone process (runs without AudioForge Electron app)
- Direct access to AudioForge's SQLite database (WAL mode, concurrent-safe)
- Invokes same external tools (ffmpeg, aubio, demucs, basic-pitch, stable-audio)
- Shares AudioForge's media directory and Python virtual environment
- Atomic task cards completable by Claude Haiku in a single turn

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Claude Agent                    │
│              (Claude Code / Desktop)             │
└──────────────────┬──────────────────────────────┘
                   │  stdio (JSON-RPC)
┌──────────────────▼──────────────────────────────┐
│            AudioForge MCP Server                 │
│                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐  │
│  │ Resources │ │   Tools   │ │    Prompts    │  │
│  └─────┬─────┘ └─────┬─────┘ └───────┬───────┘  │
│        │              │               │          │
│  ┌─────▼──────────────▼───────────────▼───────┐  │
│  │              Service Layer                  │  │
│  │  ┌────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │  DB    │ │ Analysis │ │  Processing  │  │  │
│  │  │Queries │ │ (aubio)  │ │  (ffmpeg)    │  │  │
│  │  └───┬────┘ └────┬─────┘ └──────┬───────┘  │  │
│  │      │           │              │           │  │
│  │  ┌───▼───┐  ┌────▼────┐  ┌─────▼────────┐  │  │
│  │  │SQLite │  │CLI tools│  │Python venv   │  │  │
│  │  │(WAL)  │  │ffmpeg   │  │demucs        │  │  │
│  │  │       │  │ffprobe  │  │basic-pitch   │  │  │
│  │  │       │  │aubio    │  │stable-audio  │  │  │
│  │  └───────┘  └─────────┘  └──────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
         │                    │
    ┌────▼────┐         ┌────▼────┐
    │audioforge│         │ media/ │
    │   .db   │         │ files  │
    └─────────┘         └────────┘
```

**Key Data Paths**:
- Database: `~/Library/Application Support/audioforge/audioforge.db`
- Media: `~/Library/Application Support/audioforge/media/`
- YouTube: `~/Library/Application Support/audioforge/media/youtube/`
- Python venv: `~/.audioforge-venv/`
- External tools: Resolved via PATH (`/opt/homebrew/bin`, `/usr/local/bin`, etc.)

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| MCP Framework | @modelcontextprotocol/sdk 1.12.0 | Server, transport, protocol |
| Language | TypeScript 5.7 (strict) | Type safety |
| Database | better-sqlite3 12.0.0 | Direct SQLite access (WAL) |
| Search | fuse.js 7.0.0 | Fuzzy search across assets |
| Schema | zod 3.25.0 | Tool input validation |
| Frontmatter | gray-matter 4.0.3 | Metadata parsing |
| Dev runner | tsx 4.19.0 | No-build development |
| Testing | vitest 4.1.2 | Unit & integration tests |
| Audio analysis | aubio (CLI) | BPM, key detection |
| Audio processing | ffmpeg/ffprobe (CLI) | Convert, effects, metadata |
| Stem separation | demucs (Python) | Vocal/drum/bass/other isolation |
| Audio-to-MIDI | basic-pitch (Python) | Pitch-based MIDI extraction |
| AI generation | stable-audio (Python) | Text-to-audio synthesis |

---

## 4. Directory Structure

```
audio-forge/mcp/
├── src/
│   ├── index.ts              — Entry point, MCP server setup
│   ├── constants.ts          — Paths, config, defaults
│   ├── db.ts                 — SQLite connection & helpers
│   ├── queries/
│   │   ├── assets.ts         — Asset CRUD queries
│   │   ├── collections.ts    — Collection queries
│   │   ├── projects.ts       — Project queries
│   │   └── midi.ts           — MIDI file queries
│   ├── search.ts             — Fuse.js fuzzy search
│   ├── analysis/
│   │   ├── bpm.ts            — BPM detection (aubio tempo)
│   │   ├── key-detect.ts     — Key detection (aubio pitch)
│   │   └── metadata.ts       — ffprobe metadata extraction
│   ├── processing/
│   │   ├── convert.ts        — Format conversion (ffmpeg)
│   │   ├── effects.ts        — Audio effects (trim, fade, etc.)
│   │   ├── mastering.ts      — Mastering chain
│   │   ├── stems.ts          — Stem separation (demucs)
│   │   ├── audio-to-midi.ts  — Audio-to-MIDI (basic-pitch)
│   │   ├── generation.ts     — AI audio generation
│   │   └── loops.ts          — Loop detection & extraction
│   ├── hardware/
│   │   ├── sp404.ts          — SP-404 MK2 kit operations
│   │   ├── koala.ts          — Koala sampler operations
│   │   └── emx1.ts           — EMX-1 MIDI operations
│   ├── utils/
│   │   ├── youtube.ts        — YouTube download
│   │   ├── camelot.ts        — Harmonic mixing (Camelot wheel)
│   │   ├── watcher.ts        — Watch folder management
│   │   └── process-runner.ts — Child process execution helper
│   ├── resources.ts          — MCP resource registration
│   ├── tools.ts              — MCP tool registration
│   └── prompts.ts            — MCP prompt registration
├── package.json
├── tsconfig.json
└── ARCH_SPEC.md
```

---

## 5. MCP API Contract

### 5.1 Resources

| URI | Description | Response |
|-----|-------------|----------|
| `audioforge://library` | Full asset index | JSON array of all assets (id, name, file_path, bpm, key, duration, tags) |
| `audioforge://asset/{id}` | Single asset details | Full asset metadata including waveform_peaks |
| `audioforge://collections` | All collections | JSON array of collections with asset counts |
| `audioforge://collection/{id}` | Collection detail | Collection with full asset list |
| `audioforge://projects` | All projects | JSON array of projects |
| `audioforge://project/{id}` | Project detail | Project metadata + associated assets |
| `audioforge://midi` | All MIDI files | JSON array of MIDI files |
| `audioforge://health` | Tool installation status | Object with ffmpeg, aubio, demucs, basic-pitch availability |
| `audioforge://jobs` | Active job queue | JSON array of pending/running jobs |

### 5.2 Tools

#### Library & Search

| Tool | Input | Description |
|------|-------|-------------|
| `search_library` | `{ query: string, limit?: number }` | Fuzzy search across asset names, tags |
| `filter_assets` | `{ bpm_min?, bpm_max?, key?, file_type?, tags?, role?, source? }` | Filter assets by metadata |
| `get_asset` | `{ id: number }` | Get full asset details |
| `import_file` | `{ file_path: string }` | Import audio file to library |
| `delete_asset` | `{ id: number }` | Soft-delete an asset |
| `update_tags` | `{ id: number, tags: string }` | Update asset tags |

#### Audio Analysis

| Tool | Input | Description |
|------|-------|-------------|
| `analyze_bpm` | `{ id: number }` | Detect BPM for an asset |
| `analyze_key` | `{ id: number }` | Detect musical key for an asset |
| `analyze_audio` | `{ id: number }` | Full analysis (BPM + key + metadata) |
| `get_metadata` | `{ file_path: string }` | Extract audio metadata (duration, sample rate, channels) |

#### Audio Processing

| Tool | Input | Description |
|------|-------|-------------|
| `convert_format` | `{ id: number, format: "wav"\|"mp3"\|"flac"\|"aiff"\|"ogg"\|"m4a"\|"aac" }` | Convert audio format |
| `trim_audio` | `{ id: number, start: number, end: number }` | Trim audio to time range (seconds) |
| `normalize_audio` | `{ id: number, target_lufs?: number }` | Loudness normalization |
| `apply_fade` | `{ id: number, fade_in?: number, fade_out?: number }` | Apply fade in/out (seconds) |
| `reverse_audio` | `{ id: number }` | Reverse audio |
| `pitch_shift` | `{ id: number, semitones: number }` | Shift pitch by semitones |
| `time_stretch` | `{ id: number, rate: number }` | Change speed (0.5 = half, 2.0 = double) |
| `remove_silence` | `{ id: number, threshold_db?: number }` | Remove silent sections |

#### Mastering

| Tool | Input | Description |
|------|-------|-------------|
| `master_audio` | `{ id: number, eq_low?, eq_mid?, eq_high?, comp_threshold?, comp_ratio?, target_lufs? }` | Apply mastering chain |
| `analyze_loudness` | `{ id: number }` | Pre-mastering loudness analysis (LUFS, peak, dynamic range) |

#### Advanced Processing

| Tool | Input | Description |
|------|-------|-------------|
| `separate_stems` | `{ id: number, model?: "htdemucs"\|"htdemucs_ft" }` | Split into vocals/drums/bass/other |
| `audio_to_midi` | `{ id: number, onset_threshold?, frame_threshold? }` | Extract MIDI from audio |
| `generate_audio` | `{ prompt: string, duration?: number, seed?: number }` | AI text-to-audio generation |
| `detect_loops` | `{ id: number }` | Find loop points in audio |
| `extract_loop` | `{ id: number, start: number, end: number }` | Extract loop segment to new file |

#### Harmonic Mixing

| Tool | Input | Description |
|------|-------|-------------|
| `get_compatible_keys` | `{ key: string }` | Get Camelot-compatible keys for mixing |
| `find_compatible_assets` | `{ id: number }` | Find assets that mix well with given asset |

#### Collections & Projects

| Tool | Input | Description |
|------|-------|-------------|
| `create_collection` | `{ name: string, description?: string }` | Create a new collection |
| `add_to_collection` | `{ collection_id: number, asset_id: number }` | Add asset to collection |
| `remove_from_collection` | `{ collection_id: number, asset_id: number }` | Remove asset from collection |
| `export_collection` | `{ collection_id: number, output_path: string }` | Export collection as ZIP |
| `create_project` | `{ name: string, bpm?: number, key?: string }` | Create a new project |
| `update_project` | `{ id: number, name?, bpm?, key?, description? }` | Update project metadata |

#### YouTube

| Tool | Input | Description |
|------|-------|-------------|
| `youtube_info` | `{ url: string }` | Get video title, duration, thumbnail |
| `youtube_download` | `{ url: string, format?: "wav"\|"mp3"\|"flac" }` | Download audio and import to library |

#### Hardware

| Tool | Input | Description |
|------|-------|-------------|
| `sp404_export_kit` | `{ bank: string, pads: { pad: number, asset_id: number }[] }` | Export kit to SP-404 SD card |
| `sp404_detect_sd` | `{}` | Detect connected SP-404 SD cards |
| `koala_export_kit` | `{ name: string, pads: { pad: number, asset_id: number }[] }` | Export kit for Koala sampler |
| `emx1_export_midi` | `{ pattern_data: string, output_path: string }` | Export EMX-1 pattern to MIDI file |

#### Watch Folders

| Tool | Input | Description |
|------|-------|-------------|
| `add_watch_folder` | `{ path: string }` | Start watching a directory for new audio |
| `remove_watch_folder` | `{ path: string }` | Stop watching a directory |
| `list_watch_folders` | `{}` | List active watch folders |

### 5.3 Prompts

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `project_context` | `{ project: string }` | Load full project context for the agent |
| `mixing_assistant` | `{ asset_id: number }` | Harmonic mixing suggestions for an asset |
| `production_workflow` | `{ goal: string }` | Step-by-step audio production pipeline |
| `asset_analysis` | `{ asset_id: number }` | Detailed analysis report for an asset |

---

## 6. Implementation Phases

Total: **10 phases, 30 task cards** (T0.1–T9.2)

Each task creates/edits **1–2 files**, each file **< 80 lines**.

---

### Phase 0: Project Scaffold (~15 min)

#### T0.1 — Create package.json

**Goal**: Initialize the MCP server npm project.

**Create**: `mcp/package.json`

```json
{
  "name": "audioforge-mcp",
  "version": "1.0.0",
  "description": "MCP server exposing AudioForge capabilities to Claude agents",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "better-sqlite3": "^12.0.0",
    "fuse.js": "^7.0.0",
    "gray-matter": "^4.0.3",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "@vitest/ui": "^4.1.2",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.2"
  }
}
```

**Then run**: `cd mcp && npm install`

**Success**: `node_modules/` created, zero npm warnings.

---

#### T0.2 — Create tsconfig.json

**Goal**: TypeScript configuration matching AudioForge conventions.

**Create**: `mcp/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T0.3 — Constants & Configuration

**Goal**: Centralize all paths, defaults, and configuration values.

**Create**: `mcp/src/constants.ts`

```typescript
import { homedir } from 'os';
import { join } from 'path';

// AudioForge data paths (match Electron app conventions)
const USER_DATA = join(homedir(), 'Library', 'Application Support', 'audioforge');

export const DB_PATH = join(USER_DATA, 'audioforge.db');
export const MEDIA_DIR = join(USER_DATA, 'media');
export const YOUTUBE_DIR = join(MEDIA_DIR, 'youtube');
export const VENV_BIN = join(homedir(), '.audioforge-venv', 'bin');

// Server metadata
export const SERVER_NAME = 'audioforge-mcp';
export const SERVER_VERSION = '1.0.0';
export const URI_SCHEME = 'audioforge';

// Search defaults
export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;

// Audio format support
export const SUPPORTED_FORMATS = ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a', 'aac'] as const;
export type AudioFormat = (typeof SUPPORTED_FORMATS)[number];

// Tool paths (resolved via PATH)
export const TOOL_PATHS = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  aubio: 'aubio',
  demucs: join(VENV_BIN, 'demucs'),
  basicPitch: join(VENV_BIN, 'basic-pitch'),
} as const;

// PATH augmentation (match AudioForge's process-runner.ts)
export const EXTRA_PATH = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  join(homedir(), '.local', 'bin'),
  VENV_BIN,
].join(':');
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T0.4 — Entry Point (Server Skeleton)

**Goal**: Create the MCP server entry point with stdio transport.

**Create**: `mcp/src/index.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';

async function main() {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Phase 1+: Register resources, tools, prompts here

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_NAME} v${SERVER_VERSION} started\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
```

**Then run**: `cd mcp && npx tsx src/index.ts 2>&1 | head -1`

**Success**: Prints `audioforge-mcp v1.0.0 started`.

---

### Phase 1: Database & Asset Access (~20 min)

#### T1.1 — Database Connection

**Goal**: Connect to AudioForge's SQLite database with WAL mode.

**Create**: `mcp/src/db.ts`

```typescript
import Database from 'better-sqlite3';
import { DB_PATH } from './constants.js';
import { existsSync } from 'fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!existsSync(DB_PATH)) {
    throw new Error(`AudioForge database not found at: ${DB_PATH}`);
  }

  db = new Database(DB_PATH, { readonly: false });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T1.2 — Asset Queries

**Goal**: Query functions for listing, getting, and filtering assets.

**Create**: `mcp/src/queries/assets.ts`

```typescript
import { getDb } from '../db.js';

export interface Asset {
  id: number;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  duration: number | null;
  sample_rate: number | null;
  channels: number | null;
  bpm: number | null;
  key: string | null;
  role: string | null;
  tags: string | null;
  source: string | null;
  analyzed_at: string | null;
  waveform_peaks: string | null;
  created_at: string;
}

export function listAssets(): Asset[] {
  return getDb().prepare('SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as Asset[];
}

export function getAssetById(id: number): Asset | undefined {
  return getDb().prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(id) as Asset | undefined;
}

export function filterAssets(filters: {
  bpm_min?: number;
  bpm_max?: number;
  key?: string;
  file_type?: string;
  role?: string;
  source?: string;
  tags?: string;
}): Asset[] {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (filters.bpm_min !== undefined) { conditions.push('bpm >= ?'); params.push(filters.bpm_min); }
  if (filters.bpm_max !== undefined) { conditions.push('bpm <= ?'); params.push(filters.bpm_max); }
  if (filters.key) { conditions.push('key = ?'); params.push(filters.key); }
  if (filters.file_type) { conditions.push('file_type = ?'); params.push(filters.file_type); }
  if (filters.role) { conditions.push('role = ?'); params.push(filters.role); }
  if (filters.source) { conditions.push('source = ?'); params.push(filters.source); }
  if (filters.tags) { conditions.push('tags LIKE ?'); params.push(`%${filters.tags}%`); }

  const sql = `SELECT * FROM assets WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
  return getDb().prepare(sql).all(...params) as Asset[];
}

export function updateAssetTags(id: number, tags: string): void {
  getDb().prepare('UPDATE assets SET tags = ? WHERE id = ?').run(tags, id);
}

export function softDeleteAsset(id: number): void {
  getDb().prepare("UPDATE assets SET deleted_at = datetime('now') WHERE id = ?").run(id);
}

export function insertAsset(asset: Partial<Asset>): number {
  const stmt = getDb().prepare(`
    INSERT INTO assets (name, file_path, file_type, file_size, duration, sample_rate, channels, bpm, key, role, tags, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const result = stmt.run(
    asset.name, asset.file_path, asset.file_type, asset.file_size ?? 0,
    asset.duration ?? null, asset.sample_rate ?? null, asset.channels ?? null,
    asset.bpm ?? null, asset.key ?? null, asset.role ?? null,
    asset.tags ?? null, asset.source ?? 'mcp-import'
  );
  return result.lastInsertRowid as number;
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T1.3 — Collection, Project & MIDI Queries

**Goal**: Query functions for collections, projects, and MIDI files.

**Create**: `mcp/src/queries/collections.ts`

```typescript
import { getDb } from '../db.js';

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export function listCollections(): (Collection & { asset_count: number })[] {
  return getDb().prepare(`
    SELECT c.*, COUNT(ca.asset_id) as asset_count
    FROM collections c
    LEFT JOIN collection_assets ca ON c.id = ca.collection_id
    GROUP BY c.id ORDER BY c.name
  `).all() as (Collection & { asset_count: number })[];
}

export function getCollectionAssets(collectionId: number): number[] {
  const rows = getDb().prepare(
    'SELECT asset_id FROM collection_assets WHERE collection_id = ?'
  ).all(collectionId) as { asset_id: number }[];
  return rows.map((r) => r.asset_id);
}

export function createCollection(name: string, description?: string): number {
  const result = getDb().prepare(
    "INSERT INTO collections (name, description, created_at) VALUES (?, ?, datetime('now'))"
  ).run(name, description ?? null);
  return result.lastInsertRowid as number;
}

export function addAssetToCollection(collectionId: number, assetId: number): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO collection_assets (collection_id, asset_id) VALUES (?, ?)'
  ).run(collectionId, assetId);
}

export function removeAssetFromCollection(collectionId: number, assetId: number): void {
  getDb().prepare(
    'DELETE FROM collection_assets WHERE collection_id = ? AND asset_id = ?'
  ).run(collectionId, assetId);
}
```

**Create**: `mcp/src/queries/projects.ts`

```typescript
import { getDb } from '../db.js';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  created_at: string;
}

export function listProjects(): Project[] {
  return getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[];
}

export function getProjectById(id: number): Project | undefined {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function createProject(data: { name: string; bpm?: number; key?: string; description?: string }): number {
  const result = getDb().prepare(
    "INSERT INTO projects (name, description, bpm, key, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(data.name, data.description ?? null, data.bpm ?? null, data.key ?? null);
  return result.lastInsertRowid as number;
}

export function updateProject(id: number, data: Partial<Project>): void {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k !== 'id' && k !== 'created_at') { fields.push(`${k} = ?`); params.push(v as string | number | null); }
  }
  if (fields.length === 0) return;
  params.push(id);
  getDb().prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

### Phase 2: Search & Discovery (~15 min)

#### T2.1 — Fuzzy Search Index

**Goal**: Build a Fuse.js search index over library assets.

**Create**: `mcp/src/search.ts`

```typescript
import Fuse from 'fuse.js';
import type { Asset } from './queries/assets.js';

let fuse: Fuse<Asset> | null = null;

export interface SearchResult {
  id: number;
  name: string;
  file_type: string;
  bpm: number | null;
  key: string | null;
  tags: string | null;
  score: number;
}

export function buildSearchIndex(assets: Asset[]): void {
  fuse = new Fuse(assets, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'key', weight: 0.5 },
      { name: 'file_type', weight: 0.3 },
    ],
    threshold: 0.4,
    includeScore: true,
  });
}

export function searchAssets(query: string, limit: number = 10): SearchResult[] {
  if (!fuse) throw new Error('Search index not built — call buildSearchIndex first');
  return fuse.search(query, { limit }).map((r) => ({
    id: r.item.id,
    name: r.item.name,
    file_type: r.item.file_type,
    bpm: r.item.bpm,
    key: r.item.key,
    tags: r.item.tags,
    score: Math.round((1 - (r.score ?? 0)) * 100) / 100,
  }));
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T2.2 — Advanced Filtering

**Goal**: Combine fuzzy search with metadata filters.

This is already implemented in `queries/assets.ts` via `filterAssets()`. T2.2 wires the filter tool into the MCP tool registration (done in Phase 8).

**Success**: No additional code needed; verify `filterAssets` handles all filter combinations.

---

### Phase 3: Audio Analysis (~20 min)

#### T3.1 — Process Runner Utility

**Goal**: Helper for executing CLI tools with proper PATH and timeout.

**Create**: `mcp/src/utils/process-runner.ts`

```typescript
import { execFile } from 'child_process';
import { EXTRA_PATH } from '../constants.js';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: `${EXTRA_PATH}:${process.env.PATH ?? ''}` };
    const child = execFile(cmd, args, { env, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && 'killed' in err && err.killed) {
        reject(new Error(`Process timed out after ${timeoutMs}ms: ${cmd}`));
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: err ? (err as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0 });
    });
  });
}

export async function which(tool: string): Promise<boolean> {
  try {
    const result = await run('which', [tool], 5000);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T3.2 — BPM & Key Detection

**Goal**: Wrap aubio CLI for BPM and key detection.

**Create**: `mcp/src/analysis/bpm.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { TOOL_PATHS } from '../constants.js';

export async function analyzeBpm(filePath: string): Promise<number | null> {
  const result = await run(TOOL_PATHS.aubio, ['tempo', '-i', filePath]);
  if (result.exitCode !== 0) return null;

  const lines = result.stdout.trim().split('\n');
  const bpmValues = lines.map((l) => parseFloat(l)).filter((v) => !isNaN(v) && v > 0);
  if (bpmValues.length === 0) return null;

  // Average beat intervals to get BPM
  const avg = bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length;
  return Math.round(avg * 10) / 10;
}
```

**Create**: `mcp/src/analysis/key-detect.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { TOOL_PATHS } from '../constants.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export async function analyzeKey(filePath: string): Promise<string | null> {
  const result = await run(TOOL_PATHS.aubio, ['pitch', '-i', filePath, '-p', 'yinfast']);
  if (result.exitCode !== 0) return null;

  const pitches = result.stdout.trim().split('\n')
    .map((l) => parseFloat(l.split('\t')[1] ?? ''))
    .filter((v) => !isNaN(v) && v > 20 && v < 5000);

  if (pitches.length === 0) return null;

  // Build chromagram
  const chroma = new Array(12).fill(0);
  for (const hz of pitches) {
    const midi = 12 * Math.log2(hz / 440) + 69;
    const note = Math.round(midi) % 12;
    if (note >= 0 && note < 12) chroma[note]++;
  }

  // Correlate with key profiles
  let bestKey = 'C major';
  let bestCorr = -Infinity;

  for (let root = 0; root < 12; root++) {
    const rotated = chroma.slice(root).concat(chroma.slice(0, root));
    const majCorr = correlate(rotated, MAJOR_PROFILE);
    const minCorr = correlate(rotated, MINOR_PROFILE);

    if (majCorr > bestCorr) { bestCorr = majCorr; bestKey = `${NOTE_NAMES[root]} major`; }
    if (minCorr > bestCorr) { bestCorr = minCorr; bestKey = `${NOTE_NAMES[root]} minor`; }
  }

  return bestKey;
}

function correlate(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; denA += da * da; denB += db * db;
  }
  return denA === 0 || denB === 0 ? 0 : num / Math.sqrt(denA * denB);
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T3.3 — Audio Metadata Extraction

**Goal**: Use ffprobe to extract audio file metadata.

**Create**: `mcp/src/analysis/metadata.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { statSync } from 'fs';

export interface AudioMetadata {
  duration: number;
  sample_rate: number;
  channels: number;
  codec: string;
  bitrate: number;
  file_size: number;
}

export async function getAudioMetadata(filePath: string): Promise<AudioMetadata> {
  const result = await run('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  if (result.exitCode !== 0) throw new Error(`ffprobe failed: ${result.stderr}`);

  const data = JSON.parse(result.stdout);
  const stream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');
  const format = data.format ?? {};
  const stat = statSync(filePath);

  return {
    duration: parseFloat(format.duration ?? stream?.duration ?? '0'),
    sample_rate: parseInt(stream?.sample_rate ?? '0', 10),
    channels: stream?.channels ?? 0,
    codec: stream?.codec_name ?? 'unknown',
    bitrate: parseInt(format.bit_rate ?? '0', 10),
    file_size: stat.size,
  };
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

### Phase 4: Audio Processing (~25 min)

#### T4.1 — Format Conversion

**Goal**: Convert audio between formats using ffmpeg.

**Create**: `mcp/src/processing/convert.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';
import type { AudioFormat } from '../constants.js';

export async function convertFormat(inputPath: string, format: AudioFormat): Promise<string> {
  const name = basename(inputPath, extname(inputPath));
  const outputPath = join(MEDIA_DIR, `${name}_converted.${format}`);

  const args = ['-y', '-i', inputPath];

  // Format-specific encoding
  switch (format) {
    case 'mp3': args.push('-codec:a', 'libmp3lame', '-b:a', '320k'); break;
    case 'flac': args.push('-codec:a', 'flac'); break;
    case 'aac': case 'm4a': args.push('-codec:a', 'aac', '-b:a', '256k'); break;
    case 'ogg': args.push('-codec:a', 'libvorbis', '-q:a', '8'); break;
    case 'aiff': args.push('-codec:a', 'pcm_s16be'); break;
    case 'wav': args.push('-codec:a', 'pcm_s16le'); break;
  }

  args.push(outputPath);
  const result = await run('ffmpeg', args);
  if (result.exitCode !== 0) throw new Error(`Format conversion failed: ${result.stderr}`);

  return outputPath;
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T4.2 — Audio Effects

**Goal**: Wrap ffmpeg for trim, normalize, fade, reverse, pitch shift, time stretch, silence removal.

**Create**: `mcp/src/processing/effects.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';

function outPath(input: string, suffix: string): string {
  const name = basename(input, extname(input));
  const ext = extname(input);
  return join(MEDIA_DIR, `${name}_${suffix}${ext}`);
}

export async function trimAudio(inputPath: string, start: number, end: number): Promise<string> {
  const output = outPath(inputPath, 'trimmed');
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-ss', String(start), '-to', String(end), '-c', 'copy', output]);
  if (result.exitCode !== 0) throw new Error(`Trim failed: ${result.stderr}`);
  return output;
}

export async function normalizeAudio(inputPath: string, targetLufs = -14): Promise<string> {
  const output = outPath(inputPath, 'normalized');
  const filter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Normalize failed: ${result.stderr}`);
  return output;
}

export async function applyFade(inputPath: string, fadeIn = 0, fadeOut = 0): Promise<string> {
  const output = outPath(inputPath, 'faded');
  const filters: string[] = [];
  if (fadeIn > 0) filters.push(`afade=t=in:d=${fadeIn}`);
  if (fadeOut > 0) filters.push(`areverse,afade=t=in:d=${fadeOut},areverse`);
  if (filters.length === 0) throw new Error('At least one fade duration required');
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filters.join(','), output]);
  if (result.exitCode !== 0) throw new Error(`Fade failed: ${result.stderr}`);
  return output;
}

export async function reverseAudio(inputPath: string): Promise<string> {
  const output = outPath(inputPath, 'reversed');
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', 'areverse', output]);
  if (result.exitCode !== 0) throw new Error(`Reverse failed: ${result.stderr}`);
  return output;
}

export async function pitchShift(inputPath: string, semitones: number): Promise<string> {
  const output = outPath(inputPath, 'pitched');
  const rate = Math.pow(2, semitones / 12);
  const filter = `asetrate=44100*${rate},aresample=44100`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Pitch shift failed: ${result.stderr}`);
  return output;
}

export async function timeStretch(inputPath: string, rate: number): Promise<string> {
  const output = outPath(inputPath, 'stretched');
  const filter = `atempo=${rate}`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Time stretch failed: ${result.stderr}`);
  return output;
}

export async function removeSilence(inputPath: string, thresholdDb = -40): Promise<string> {
  const output = outPath(inputPath, 'desilenced');
  const filter = `silenceremove=start_periods=1:start_threshold=${thresholdDb}dB:stop_periods=-1:stop_threshold=${thresholdDb}dB`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Silence removal failed: ${result.stderr}`);
  return output;
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T4.3 — Mastering Chain

**Goal**: Apply 3-band EQ, compressor, and loudness normalization.

**Create**: `mcp/src/processing/mastering.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';

export interface MasteringParams {
  eq_low_gain?: number;   // dB (-12 to +12)
  eq_mid_gain?: number;   // dB (-12 to +12)
  eq_high_gain?: number;  // dB (-12 to +12)
  comp_threshold?: number; // dB (-60 to 0)
  comp_ratio?: number;     // 1:1 to 20:1
  target_lufs?: number;    // -24 to -6
}

export async function analyzeLoudness(filePath: string): Promise<{ lufs: number; peak_db: number; dynamic_range: number }> {
  const result = await run('ffmpeg', ['-i', filePath, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const json = result.stderr.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('Could not parse loudness data');
  const data = JSON.parse(json[0]);
  return {
    lufs: parseFloat(data.input_i),
    peak_db: parseFloat(data.input_tp),
    dynamic_range: parseFloat(data.input_lra),
  };
}

export async function masterAudio(inputPath: string, params: MasteringParams = {}): Promise<string> {
  const name = basename(inputPath, extname(inputPath));
  const output = join(MEDIA_DIR, `${name}_mastered.wav`);

  const filters: string[] = [];

  // 3-band EQ
  const lowGain = params.eq_low_gain ?? 0;
  const midGain = params.eq_mid_gain ?? 0;
  const highGain = params.eq_high_gain ?? 0;
  if (lowGain || midGain || highGain) {
    filters.push(`equalizer=f=100:t=h:w=200:g=${lowGain}`);
    filters.push(`equalizer=f=1000:t=h:w=1000:g=${midGain}`);
    filters.push(`equalizer=f=8000:t=h:w=4000:g=${highGain}`);
  }

  // Compressor
  const threshold = params.comp_threshold ?? -20;
  const ratio = params.comp_ratio ?? 4;
  filters.push(`acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=10:release=200`);

  // Loudness normalization
  const targetLufs = params.target_lufs ?? -14;
  filters.push(`loudnorm=I=${targetLufs}:TP=-1.0:LRA=11`);

  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filters.join(','), output]);
  if (result.exitCode !== 0) throw new Error(`Mastering failed: ${result.stderr}`);
  return output;
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

### Phase 5: AI & Advanced Processing (~25 min)

#### T5.1 — Stem Separation

**Goal**: Wrap demucs for vocal/drum/bass/other isolation.

**Create**: `mcp/src/processing/stems.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { TOOL_PATHS, MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

export type StemModel = 'htdemucs' | 'htdemucs_ft';

export interface StemResult {
  vocals: string;
  drums: string;
  bass: string;
  other: string;
}

export async function separateStems(inputPath: string, model: StemModel = 'htdemucs'): Promise<StemResult> {
  const outputDir = join(MEDIA_DIR, 'stems');
  const name = basename(inputPath, extname(inputPath));

  const result = await run(TOOL_PATHS.demucs, [
    '-n', model,
    '-o', outputDir,
    inputPath,
  ], 600_000); // 10 min timeout for GPU processing

  if (result.exitCode !== 0) throw new Error(`Stem separation failed: ${result.stderr}`);

  const stemDir = join(outputDir, model, name);
  const stems: StemResult = {
    vocals: join(stemDir, 'vocals.wav'),
    drums: join(stemDir, 'drums.wav'),
    bass: join(stemDir, 'bass.wav'),
    other: join(stemDir, 'other.wav'),
  };

  // Verify all stems exist
  for (const [stem, path] of Object.entries(stems)) {
    if (!existsSync(path)) throw new Error(`Missing stem file: ${stem} at ${path}`);
  }

  return stems;
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T5.2 — Audio-to-MIDI Conversion

**Goal**: Wrap basic-pitch for MIDI extraction from audio.

**Create**: `mcp/src/processing/audio-to-midi.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { TOOL_PATHS, MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

export interface MidiConversionResult {
  midi_path: string;
  note_count: number;
}

export async function audioToMidi(
  inputPath: string,
  options: { onset_threshold?: number; frame_threshold?: number } = {}
): Promise<MidiConversionResult> {
  const name = basename(inputPath, extname(inputPath));
  const outputDir = join(MEDIA_DIR, 'midi');
  const midiPath = join(outputDir, `${name}.mid`);

  const args = [inputPath, outputDir];

  if (options.onset_threshold !== undefined) {
    args.push('--onset-threshold', String(options.onset_threshold));
  }
  if (options.frame_threshold !== undefined) {
    args.push('--frame-threshold', String(options.frame_threshold));
  }

  const result = await run(TOOL_PATHS.basicPitch, args, 300_000); // 5 min timeout
  if (result.exitCode !== 0) throw new Error(`Audio-to-MIDI failed: ${result.stderr}`);

  if (!existsSync(midiPath)) throw new Error(`MIDI file not created at: ${midiPath}`);

  // Parse note count from output
  const noteMatch = result.stdout.match(/(\d+)\s*notes?/i);
  const noteCount = noteMatch ? parseInt(noteMatch[1], 10) : 0;

  return { midi_path: midiPath, note_count: noteCount };
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T5.3 — AI Audio Generation

**Goal**: Wrap Stable Audio Open for text-to-audio synthesis.

**Create**: `mcp/src/processing/generation.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { VENV_BIN, MEDIA_DIR } from '../constants.js';
import { join } from 'path';
import { existsSync } from 'fs';

export interface GenerationParams {
  prompt: string;
  duration?: number;  // seconds (default 10)
  seed?: number;
  steps?: number;     // inference steps (default 100)
}

export async function generateAudio(params: GenerationParams): Promise<string> {
  const { prompt, duration = 10, seed, steps = 100 } = params;
  const timestamp = Date.now();
  const safeName = prompt.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_');
  const outputPath = join(MEDIA_DIR, `generated_${safeName}_${timestamp}.wav`);

  // Use the Python script in venv
  const pythonPath = join(VENV_BIN, 'python');
  const args = [
    '-m', 'stable_audio_tools.generate',
    '--prompt', prompt,
    '--duration', String(duration),
    '--steps', String(steps),
    '--output', outputPath,
  ];

  if (seed !== undefined) args.push('--seed', String(seed));

  const result = await run(pythonPath, args, 600_000); // 10 min timeout
  if (result.exitCode !== 0) throw new Error(`Audio generation failed: ${result.stderr}`);
  if (!existsSync(outputPath)) throw new Error('Generated audio file not created');

  return outputPath;
}

export async function isModelInstalled(): Promise<boolean> {
  try {
    const pythonPath = join(VENV_BIN, 'python');
    const result = await run(pythonPath, ['-c', 'import stable_audio_tools'], 10_000);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T5.4 — Loop Detection & Extraction

**Goal**: Detect loop points and extract loops from audio.

**Create**: `mcp/src/processing/loops.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { TOOL_PATHS, MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';

export interface LoopCandidate {
  start: number;    // seconds
  end: number;      // seconds
  bars: number;     // 1, 2, 4, or 8
  confidence: number;
}

export async function detectLoops(filePath: string, bpm?: number): Promise<LoopCandidate[]> {
  // Get onsets using aubio
  const result = await run(TOOL_PATHS.aubio, ['onset', '-i', filePath]);
  if (result.exitCode !== 0) throw new Error(`Onset detection failed: ${result.stderr}`);

  const onsets = result.stdout.trim().split('\n')
    .map((l) => parseFloat(l)).filter((v) => !isNaN(v));

  if (onsets.length < 4) return [];

  // Estimate beat length
  const estimatedBpm = bpm ?? 120;
  const beatLength = 60 / estimatedBpm;

  // Generate loop candidates at 1, 2, 4, 8 bars
  const candidates: LoopCandidate[] = [];

  for (const bars of [1, 2, 4, 8]) {
    const loopLength = beatLength * 4 * bars; // 4 beats per bar
    for (let i = 0; i < onsets.length - 1; i++) {
      const start = onsets[i];
      const end = start + loopLength;
      // Score based on how close an onset is to the expected end point
      const closestOnset = onsets.reduce((best, o) =>
        Math.abs(o - end) < Math.abs(best - end) ? o : best, onsets[0]);
      const deviation = Math.abs(closestOnset - end) / loopLength;
      const confidence = Math.max(0, 1 - deviation * 4);

      if (confidence > 0.5) {
        candidates.push({ start, end: closestOnset, bars, confidence: Math.round(confidence * 100) / 100 });
      }
    }
  }

  // Sort by confidence and deduplicate
  return candidates
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}

export async function extractLoop(filePath: string, start: number, end: number): Promise<string> {
  const name = basename(filePath, extname(filePath));
  const ext = extname(filePath);
  const output = join(MEDIA_DIR, `${name}_loop_${Math.round(start * 100)}${ext}`);

  const result = await run('ffmpeg', ['-y', '-i', filePath, '-ss', String(start), '-to', String(end), '-c', 'copy', output]);
  if (result.exitCode !== 0) throw new Error(`Loop extraction failed: ${result.stderr}`);

  return output;
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

### Phase 6: Hardware Integration (~20 min)

#### T6.1 — SP-404 MK2 Kit Export

**Goal**: Export sample kits to SP-404 MK2 SD card format.

**Create**: `mcp/src/hardware/sp404.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';

const SP404_SAMPLE_RATE = 48000;
const SP404_BIT_DEPTH = 16;
const SP404_CHANNELS = 2;

export interface PadAssignment {
  pad: number;     // 0-15
  asset_path: string;
}

export async function exportKit(
  sdCardPath: string,
  bank: string,
  pads: PadAssignment[]
): Promise<string[]> {
  const bankDir = join(sdCardPath, 'ROLAND', 'SP-404MKII', 'SAMPLE', bank.toUpperCase());
  mkdirSync(bankDir, { recursive: true });

  const exported: string[] = [];

  for (const { pad, asset_path } of pads) {
    const padName = String(pad + 1).padStart(4, '0');
    const outputPath = join(bankDir, `${padName}.WAV`);

    // Convert to SP-404 format: 48kHz, 16-bit, stereo WAV
    const result = await run('ffmpeg', [
      '-y', '-i', asset_path,
      '-ar', String(SP404_SAMPLE_RATE),
      '-ac', String(SP404_CHANNELS),
      '-sample_fmt', `s${SP404_BIT_DEPTH}`,
      '-codec:a', 'pcm_s16le',
      outputPath,
    ]);

    if (result.exitCode !== 0) throw new Error(`SP-404 export failed for pad ${pad}: ${result.stderr}`);
    exported.push(outputPath);
  }

  return exported;
}

export function detectSDCards(): string[] {
  const volumesDir = '/Volumes';
  if (!existsSync(volumesDir)) return [];

  return readdirSync(volumesDir)
    .map((v) => join(volumesDir, v))
    .filter((v) => existsSync(join(v, 'ROLAND', 'SP-404MKII')));
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T6.2 — Koala & EMX-1

**Goal**: Koala sampler kit export and EMX-1 MIDI export.

**Create**: `mcp/src/hardware/koala.ts`

```typescript
import { run } from '../utils/process-runner.js';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { MEDIA_DIR } from '../constants.js';

const KOALA_SAMPLE_RATE = 44100;

export interface KoalaPad {
  pad: number;       // 0-63 (4 banks x 16 pads)
  asset_path: string;
}

export async function exportKoalaKit(name: string, pads: KoalaPad[]): Promise<string> {
  const kitDir = join(MEDIA_DIR, 'koala', name);
  mkdirSync(kitDir, { recursive: true });

  for (const { pad, asset_path } of pads) {
    const padName = String(pad + 1).padStart(2, '0');
    const outputPath = join(kitDir, `pad_${padName}.wav`);

    await run('ffmpeg', [
      '-y', '-i', asset_path,
      '-ar', String(KOALA_SAMPLE_RATE),
      '-ac', '2',
      '-codec:a', 'pcm_s16le',
      outputPath,
    ]);
  }

  return kitDir;
}
```

**Create**: `mcp/src/hardware/emx1.ts`

```typescript
import { MEDIA_DIR } from '../constants.js';
import { join } from 'path';
import { writeFileSync } from 'fs';

export interface EMX1Pattern {
  name: string;
  bpm: number;
  steps: { part: number; step: number; velocity: number }[];
}

export function exportEmx1ToMidi(pattern: EMX1Pattern): string {
  // Simple MIDI file generation for EMX-1 patterns
  const outputPath = join(MEDIA_DIR, 'emx1', `${pattern.name}.mid`);

  // MIDI header + track data
  const header = Buffer.from([
    0x4D, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // length 6
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 track
    0x00, 0x60,             // 96 ticks per beat
  ]);

  // Build track events from pattern steps
  const events: number[] = [];
  const ticksPerStep = 24; // 96 ticks / 4 steps per beat

  for (const step of pattern.steps.sort((a, b) => a.step - b.step)) {
    const noteNum = 36 + step.part; // GM drum map starting at C2
    const delta = step.step * ticksPerStep;
    // Note on
    events.push(delta, 0x99, noteNum, step.velocity);
    // Note off (1 tick later)
    events.push(1, 0x89, noteNum, 0);
  }

  // End of track
  events.push(0, 0xFF, 0x2F, 0x00);

  const trackData = Buffer.from(events);
  const trackHeader = Buffer.from([
    0x4D, 0x54, 0x72, 0x6B, // MTrk
    ...[(trackData.length >> 24) & 0xFF, (trackData.length >> 16) & 0xFF,
        (trackData.length >> 8) & 0xFF, trackData.length & 0xFF],
  ]);

  const { mkdirSync } = require('fs');
  const { dirname } = require('path');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.concat([header, trackHeader, trackData]));

  return outputPath;
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

### Phase 7: Utility Tools (~20 min)

#### T7.1 — YouTube Import

**Goal**: Download audio from YouTube URLs.

**Create**: `mcp/src/utils/youtube.ts`

```typescript
import { run } from './process-runner.js';
import { YOUTUBE_DIR } from '../constants.js';
import { join } from 'path';
import { mkdirSync } from 'fs';

export interface VideoInfo {
  title: string;
  duration: number;
  uploader: string;
  thumbnail: string;
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const result = await run('yt-dlp', ['--dump-json', '--no-download', url], 30_000);
  if (result.exitCode !== 0) throw new Error(`yt-dlp info failed: ${result.stderr}`);

  const data = JSON.parse(result.stdout);
  return {
    title: data.title ?? 'Unknown',
    duration: data.duration ?? 0,
    uploader: data.uploader ?? 'Unknown',
    thumbnail: data.thumbnail ?? '',
  };
}

export async function downloadAudio(url: string, format: string = 'wav'): Promise<string> {
  mkdirSync(YOUTUBE_DIR, { recursive: true });

  const outputTemplate = join(YOUTUBE_DIR, '%(title)s.%(ext)s');
  const args = [
    '-x',
    '--audio-format', format,
    '--audio-quality', '0',
    '-o', outputTemplate,
    '--no-playlist',
    url,
  ];

  const result = await run('yt-dlp', args, 300_000); // 5 min timeout
  if (result.exitCode !== 0) throw new Error(`YouTube download failed: ${result.stderr}`);

  // Parse output path from yt-dlp output
  const destMatch = result.stdout.match(/Destination:\s*(.+)/);
  const mergeMatch = result.stdout.match(/\[ExtractAudio\].*?:\s*(.+)/);
  return mergeMatch?.[1]?.trim() ?? destMatch?.[1]?.trim() ?? join(YOUTUBE_DIR, 'downloaded.' + format);
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T7.2 — Harmonic Mixing (Camelot Wheel)

**Goal**: Map musical keys to Camelot codes and find compatible keys.

**Create**: `mcp/src/utils/camelot.ts`

```typescript
// Camelot Wheel mapping
const CAMELOT_MAP: Record<string, string> = {
  'A-flat minor': '1A', 'B major': '1B',
  'E-flat minor': '2A', 'F-sharp major': '2B',
  'B-flat minor': '3A', 'D-flat major': '3B',
  'F minor': '4A', 'A-flat major': '4B',
  'C minor': '5A', 'E-flat major': '5B',
  'G minor': '6A', 'B-flat major': '6B',
  'D minor': '7A', 'F major': '7B',
  'A minor': '8A', 'C major': '8B',
  'E minor': '9A', 'G major': '9B',
  'B minor': '10A', 'D major': '10B',
  'F-sharp minor': '11A', 'A major': '11B',
  'D-flat minor': '12A', 'E major': '12B',
  // Aliases with sharps/flats
  'G# minor': '1A', 'Cb major': '1B',
  'D# minor': '2A', 'Gb major': '2B',
  'Bb minor': '3A', 'Db major': '3B',
  'Ab major': '4B', 'Eb major': '5B',
  'Bb major': '6B', 'F# minor': '11A',
  'C# minor': '12A',
};

export interface CompatibleKey {
  key: string;
  camelot: string;
  type: string; // 'perfect' | 'adjacent' | 'relative' | 'energy_boost'
}

export function getCamelotCode(key: string): string | null {
  return CAMELOT_MAP[key] ?? null;
}

export function getCompatibleKeys(key: string): CompatibleKey[] {
  const code = CAMELOT_MAP[key];
  if (!code) return [];

  const num = parseInt(code);
  const letter = code.slice(-1); // A or B
  const results: CompatibleKey[] = [];

  // Perfect match
  results.push({ key, camelot: code, type: 'perfect' });

  // Adjacent keys (±1 on wheel)
  const prev = ((num - 2 + 12) % 12) + 1;
  const next = (num % 12) + 1;
  addByCode(`${prev}${letter}`, 'adjacent', results);
  addByCode(`${next}${letter}`, 'adjacent', results);

  // Relative major/minor (same number, different letter)
  const otherLetter = letter === 'A' ? 'B' : 'A';
  addByCode(`${num}${otherLetter}`, 'relative', results);

  // Energy boost (+7 semitones)
  const boost = ((num + 6) % 12) + 1;
  addByCode(`${boost}${letter}`, 'energy_boost', results);

  return results;
}

function addByCode(code: string, type: string, results: CompatibleKey[]): void {
  const entry = Object.entries(CAMELOT_MAP).find(([, c]) => c === code);
  if (entry) results.push({ key: entry[0], camelot: code, type });
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T7.3 — Watch Folder Management

**Goal**: Track directories being watched for new audio files.

**Create**: `mcp/src/utils/watcher.ts`

```typescript
import { watch, existsSync, readdirSync, statSync, type FSWatcher } from 'fs';
import { join, extname } from 'path';

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.aiff', '.ogg', '.m4a', '.aac']);
const watchers = new Map<string, FSWatcher>();

export function addWatchFolder(path: string, onNewFile: (filePath: string) => void): void {
  if (watchers.has(path)) return;
  if (!existsSync(path)) throw new Error(`Directory not found: ${path}`);

  const watcher = watch(path, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const ext = extname(filename).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) return;
    const fullPath = join(path, filename);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      // Debounce: wait 800ms for write completion
      setTimeout(() => onNewFile(fullPath), 800);
    }
  });

  watchers.set(path, watcher);
}

export function removeWatchFolder(path: string): boolean {
  const watcher = watchers.get(path);
  if (!watcher) return false;
  watcher.close();
  watchers.delete(path);
  return true;
}

export function listWatchFolders(): string[] {
  return Array.from(watchers.keys());
}

export function closeAllWatchers(): void {
  for (const [, watcher] of watchers) watcher.close();
  watchers.clear();
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

### Phase 8: MCP Wiring (~30 min)

#### T8.1 — Resource Registration

**Goal**: Register all MCP resources for library browsing.

**Create**: `mcp/src/resources.ts`

```typescript
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
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T8.2 — Tool Registration: Library, Search & Analysis

**Goal**: Register MCP tools for library management, search, and analysis.

**Create**: `mcp/src/tools-library.ts`

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listAssets, getAssetById, filterAssets, updateAssetTags, softDeleteAsset, insertAsset } from './queries/assets.js';
import { buildSearchIndex, searchAssets } from './search.js';
import { analyzeBpm } from './analysis/bpm.js';
import { analyzeKey } from './analysis/key-detect.js';
import { getAudioMetadata } from './analysis/metadata.js';
import { getDb } from './db.js';

export function registerLibraryTools(server: McpServer): void {
  // Search library
  server.tool('search_library',
    { query: z.string().min(2).max(200), limit: z.number().min(1).max(50).optional() },
    async ({ query, limit }) => {
      buildSearchIndex(listAssets());
      const results = searchAssets(query, limit ?? 10);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
  );

  // Filter assets
  server.tool('filter_assets',
    {
      bpm_min: z.number().optional(), bpm_max: z.number().optional(),
      key: z.string().optional(), file_type: z.string().optional(),
      role: z.string().optional(), source: z.string().optional(),
      tags: z.string().optional(),
    },
    async (filters) => {
      const results = filterAssets(filters);
      return { content: [{ type: 'text', text: JSON.stringify(results.map((a) => ({
        id: a.id, name: a.name, bpm: a.bpm, key: a.key, file_type: a.file_type, tags: a.tags,
      })), null, 2) }] };
    }
  );

  // Get asset details
  server.tool('get_asset',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text', text: `Asset ${id} not found` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(asset, null, 2) }] };
    }
  );

  // Update tags
  server.tool('update_tags',
    { id: z.number(), tags: z.string() },
    async ({ id, tags }) => {
      updateAssetTags(id, tags);
      return { content: [{ type: 'text', text: `Tags updated for asset ${id}` }] };
    }
  );

  // Delete asset
  server.tool('delete_asset',
    { id: z.number() },
    async ({ id }) => {
      softDeleteAsset(id);
      return { content: [{ type: 'text', text: `Asset ${id} moved to trash` }] };
    }
  );

  // Analyze BPM
  server.tool('analyze_bpm',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text', text: `Asset ${id} not found` }], isError: true };
      const bpm = await analyzeBpm(asset.file_path);
      if (bpm) getDb().prepare('UPDATE assets SET bpm = ? WHERE id = ?').run(bpm, id);
      return { content: [{ type: 'text', text: JSON.stringify({ id, bpm }) }] };
    }
  );

  // Analyze key
  server.tool('analyze_key',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text', text: `Asset ${id} not found` }], isError: true };
      const key = await analyzeKey(asset.file_path);
      if (key) getDb().prepare('UPDATE assets SET key = ? WHERE id = ?').run(key, id);
      return { content: [{ type: 'text', text: JSON.stringify({ id, key }) }] };
    }
  );

  // Full analysis
  server.tool('analyze_audio',
    { id: z.number() },
    async ({ id }) => {
      const asset = getAssetById(id);
      if (!asset) return { content: [{ type: 'text', text: `Asset ${id} not found` }], isError: true };
      const [bpm, key, metadata] = await Promise.all([
        analyzeBpm(asset.file_path), analyzeKey(asset.file_path), getAudioMetadata(asset.file_path),
      ]);
      const db = getDb();
      db.prepare('UPDATE assets SET bpm = ?, key = ?, duration = ?, sample_rate = ?, channels = ?, analyzed_at = datetime(\'now\') WHERE id = ?')
        .run(bpm, key, metadata.duration, metadata.sample_rate, metadata.channels, id);
      return { content: [{ type: 'text', text: JSON.stringify({ id, bpm, key, ...metadata }) }] };
    }
  );

  // Get metadata
  server.tool('get_metadata',
    { file_path: z.string() },
    async ({ file_path }) => {
      const metadata = await getAudioMetadata(file_path);
      return { content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }] };
    }
  );
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T8.3 — Tool Registration: Processing, AI & Hardware

**Goal**: Register MCP tools for audio processing, AI features, and hardware.

**Create**: `mcp/src/tools-processing.ts`

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAssetById, insertAsset } from './queries/assets.js';
import { convertFormat } from './processing/convert.js';
import { trimAudio, normalizeAudio, applyFade, reverseAudio, pitchShift, timeStretch, removeSilence } from './processing/effects.js';
import { masterAudio, analyzeLoudness } from './processing/mastering.js';
import { separateStems } from './processing/stems.js';
import { audioToMidi } from './processing/audio-to-midi.js';
import { generateAudio, isModelInstalled } from './processing/generation.js';
import { detectLoops, extractLoop } from './processing/loops.js';
import { getCompatibleKeys } from './utils/camelot.js';
import { listAssets } from './queries/assets.js';
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
      if (!asset) return { content: [{ type: 'text', text: `Asset ${id} not found` }], isError: true };
      const outputPath = await convertFormat(asset.file_path, format);
      const newId = insertAsset({ name: `${asset.name} (${format})`, file_path: outputPath, file_type: format, file_size: statSync(outputPath).size });
      return { content: [{ type: 'text', text: JSON.stringify({ id: newId, path: outputPath }) }] };
    }
  );

  server.tool('trim_audio', { id: z.number(), start: z.number(), end: z.number() }, async ({ id, start, end }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await trimAudio(asset.file_path, start, end);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  server.tool('normalize_audio', { id: z.number(), target_lufs: z.number().optional() }, async ({ id, target_lufs }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await normalizeAudio(asset.file_path, target_lufs);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  server.tool('apply_fade', { id: z.number(), fade_in: z.number().optional(), fade_out: z.number().optional() }, async ({ id, fade_in, fade_out }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await applyFade(asset.file_path, fade_in, fade_out);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  server.tool('reverse_audio', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await reverseAudio(asset.file_path);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  server.tool('pitch_shift', { id: z.number(), semitones: z.number().min(-24).max(24) }, async ({ id, semitones }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await pitchShift(asset.file_path, semitones);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  server.tool('time_stretch', { id: z.number(), rate: z.number().min(0.25).max(4) }, async ({ id, rate }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await timeStretch(asset.file_path, rate);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  server.tool('remove_silence', { id: z.number(), threshold_db: z.number().optional() }, async ({ id, threshold_db }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await removeSilence(asset.file_path, threshold_db);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  // --- Mastering ---
  server.tool('master_audio', {
    id: z.number(), eq_low_gain: z.number().optional(), eq_mid_gain: z.number().optional(),
    eq_high_gain: z.number().optional(), comp_threshold: z.number().optional(),
    comp_ratio: z.number().optional(), target_lufs: z.number().optional(),
  }, async ({ id, ...params }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await masterAudio(asset.file_path, params);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  server.tool('analyze_loudness', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const result = await analyzeLoudness(asset.file_path);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  // --- Advanced Processing ---
  server.tool('separate_stems', { id: z.number(), model: z.enum(['htdemucs', 'htdemucs_ft']).optional() }, async ({ id, model }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const stems = await separateStems(asset.file_path, model);
    // Import each stem as a new asset
    for (const [role, path] of Object.entries(stems)) {
      insertAsset({ name: `${asset.name} (${role})`, file_path: path, file_type: 'wav', role, source: 'stem-separation' });
    }
    return { content: [{ type: 'text', text: JSON.stringify(stems) }] };
  });

  server.tool('audio_to_midi', { id: z.number(), onset_threshold: z.number().optional(), frame_threshold: z.number().optional() }, async ({ id, ...opts }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const result = await audioToMidi(asset.file_path, opts);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  server.tool('generate_audio', { prompt: z.string().min(3).max(500), duration: z.number().optional(), seed: z.number().optional() }, async (params) => {
    const installed = await isModelInstalled();
    if (!installed) return { content: [{ type: 'text', text: 'Stable Audio model not installed' }], isError: true };
    const path = await generateAudio(params);
    const name = basename(path, extname(path));
    insertAsset({ name, file_path: path, file_type: 'wav', source: 'generated' });
    return { content: [{ type: 'text', text: JSON.stringify({ path }) }] };
  });

  server.tool('detect_loops', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const loops = await detectLoops(asset.file_path, asset.bpm ?? undefined);
    return { content: [{ type: 'text', text: JSON.stringify(loops, null, 2) }] };
  });

  server.tool('extract_loop', { id: z.number(), start: z.number(), end: z.number() }, async ({ id, start, end }) => {
    const asset = getAssetById(id); if (!asset) return { content: [{ type: 'text', text: 'Not found' }], isError: true };
    const out = await extractLoop(asset.file_path, start, end);
    return { content: [{ type: 'text', text: JSON.stringify({ path: out }) }] };
  });

  // --- Harmonic Mixing ---
  server.tool('get_compatible_keys', { key: z.string() }, async ({ key }) => {
    const results = getCompatibleKeys(key);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  });

  server.tool('find_compatible_assets', { id: z.number() }, async ({ id }) => {
    const asset = getAssetById(id);
    if (!asset?.key) return { content: [{ type: 'text', text: 'Asset has no key detected' }], isError: true };
    const compatKeys = getCompatibleKeys(asset.key).map((c) => c.key);
    const allAssets = listAssets().filter((a) => a.key && compatKeys.includes(a.key) && a.id !== id);
    return { content: [{ type: 'text', text: JSON.stringify(allAssets.map((a) => ({
      id: a.id, name: a.name, key: a.key, bpm: a.bpm,
    })), null, 2) }] };
  });

  // --- YouTube ---
  server.tool('youtube_info', { url: z.string().url() }, async ({ url }) => {
    const info = await getVideoInfo(url);
    return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
  });

  server.tool('youtube_download', { url: z.string().url(), format: z.enum(['wav', 'mp3', 'flac']).optional() }, async ({ url, format }) => {
    const path = await downloadAudio(url, format ?? 'wav');
    const name = basename(path, extname(path));
    insertAsset({ name, file_path: path, file_type: format ?? 'wav', source: 'youtube' });
    return { content: [{ type: 'text', text: JSON.stringify({ path }) }] };
  });

  // --- Hardware ---
  server.tool('sp404_export_kit', {
    sd_card_path: z.string(), bank: z.string(),
    pads: z.array(z.object({ pad: z.number().min(0).max(15), asset_id: z.number() })),
  }, async ({ sd_card_path, bank, pads }) => {
    const assignments = pads.map((p) => {
      const asset = getAssetById(p.asset_id);
      if (!asset) throw new Error(`Asset ${p.asset_id} not found`);
      return { pad: p.pad, asset_path: asset.file_path };
    });
    const exported = await exportKit(sd_card_path, bank, assignments);
    return { content: [{ type: 'text', text: JSON.stringify({ exported }) }] };
  });

  server.tool('sp404_detect_sd', {}, async () => {
    const cards = detectSDCards();
    return { content: [{ type: 'text', text: JSON.stringify({ sd_cards: cards }) }] };
  });

  server.tool('koala_export_kit', {
    name: z.string(), pads: z.array(z.object({ pad: z.number().min(0).max(63), asset_id: z.number() })),
  }, async ({ name, pads }) => {
    const assignments = pads.map((p) => {
      const asset = getAssetById(p.asset_id);
      if (!asset) throw new Error(`Asset ${p.asset_id} not found`);
      return { pad: p.pad, asset_path: asset.file_path };
    });
    const kitDir = await exportKoalaKit(name, assignments);
    return { content: [{ type: 'text', text: JSON.stringify({ kit_dir: kitDir }) }] };
  });

  server.tool('emx1_export_midi', {
    name: z.string(), bpm: z.number(),
    steps: z.array(z.object({ part: z.number(), step: z.number(), velocity: z.number() })),
  }, async (pattern) => {
    const path = exportEmx1ToMidi(pattern);
    return { content: [{ type: 'text', text: JSON.stringify({ path }) }] };
  });

  // --- Collections ---
  server.tool('create_collection', { name: z.string(), description: z.string().optional() }, async ({ name, description }) => {
    const id = createCollection(name, description);
    return { content: [{ type: 'text', text: JSON.stringify({ id, name }) }] };
  });

  server.tool('add_to_collection', { collection_id: z.number(), asset_id: z.number() }, async ({ collection_id, asset_id }) => {
    addAssetToCollection(collection_id, asset_id);
    return { content: [{ type: 'text', text: `Asset ${asset_id} added to collection ${collection_id}` }] };
  });

  server.tool('remove_from_collection', { collection_id: z.number(), asset_id: z.number() }, async ({ collection_id, asset_id }) => {
    removeAssetFromCollection(collection_id, asset_id);
    return { content: [{ type: 'text', text: `Asset ${asset_id} removed from collection ${collection_id}` }] };
  });

  // --- Projects ---
  server.tool('create_project', { name: z.string(), bpm: z.number().optional(), key: z.string().optional(), description: z.string().optional() },
    async (data) => {
      const id = createProject(data);
      return { content: [{ type: 'text', text: JSON.stringify({ id, ...data }) }] };
    }
  );

  server.tool('update_project', { id: z.number(), name: z.string().optional(), bpm: z.number().optional(), key: z.string().optional(), description: z.string().optional() },
    async ({ id, ...data }) => {
      updateProject(id, data);
      return { content: [{ type: 'text', text: `Project ${id} updated` }] };
    }
  );

  // --- Watch Folders ---
  server.tool('add_watch_folder', { path: z.string() }, async ({ path }) => {
    addWatchFolder(path, (filePath) => { process.stderr.write(`New file detected: ${filePath}\n`); });
    return { content: [{ type: 'text', text: `Now watching: ${path}` }] };
  });

  server.tool('remove_watch_folder', { path: z.string() }, async ({ path }) => {
    removeWatchFolder(path);
    return { content: [{ type: 'text', text: `Stopped watching: ${path}` }] };
  });

  server.tool('list_watch_folders', {}, async () => {
    return { content: [{ type: 'text', text: JSON.stringify(listWatchFolders()) }] };
  });
}
```

**Success**: `npx tsc --noEmit` exits 0.

---

#### T8.4 — Prompt Registration

**Goal**: Register MCP prompts for agent workflows.

**Create**: `mcp/src/prompts.ts`

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAssetById, listAssets } from './queries/assets.js';
import { getProjectById } from './queries/projects.js';
import { getCompatibleKeys } from './utils/camelot.js';

export function registerPrompts(server: McpServer): void {
  // Project context prompt
  server.prompt('project_context', { project_id: z.string() }, async ({ project_id }) => {
    const project = getProjectById(parseInt(project_id));
    if (!project) return { messages: [{ role: 'user', content: { type: 'text', text: 'Project not found' } }] };

    return { messages: [{
      role: 'user',
      content: {
        type: 'text',
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

  // Mixing assistant prompt
  server.prompt('mixing_assistant', { asset_id: z.string() }, async ({ asset_id }) => {
    const asset = getAssetById(parseInt(asset_id));
    if (!asset) return { messages: [{ role: 'user', content: { type: 'text', text: 'Asset not found' } }] };

    const compatKeys = asset.key ? getCompatibleKeys(asset.key) : [];

    return { messages: [{
      role: 'user',
      content: {
        type: 'text',
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

  // Production workflow prompt
  server.prompt('production_workflow', { goal: z.string() }, async ({ goal }) => {
    const assetCount = listAssets().length;

    return { messages: [{
      role: 'user',
      content: {
        type: 'text',
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

  // Asset analysis report prompt
  server.prompt('asset_analysis', { asset_id: z.string() }, async ({ asset_id }) => {
    const asset = getAssetById(parseInt(asset_id));
    if (!asset) return { messages: [{ role: 'user', content: { type: 'text', text: 'Asset not found' } }] };

    return { messages: [{
      role: 'user',
      content: {
        type: 'text',
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
```

**Success**: `npx tsc --noEmit` exits 0.

---

### Phase 9: Assembly & Integration (~20 min)

#### T9.1 — Assemble Entry Point

**Goal**: Wire all modules into the main entry point.

**Edit**: `mcp/src/index.ts` — replace the skeleton with the full assembly.

```typescript
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
```

**Then run**: `cd mcp && npx tsx src/index.ts 2>&1 | head -2`

**Success**: Prints `Database connected: N assets found` and `audioforge-mcp v1.0.0 started (N assets)`.

---

#### T9.2 — Claude Integration Config

**Goal**: Configure Claude Code and Claude Desktop to use the AudioForge MCP.

**Claude Code** — Add to `~/.claude/settings.json` under `mcpServers`:

```json
{
  "audioforge": {
    "command": "npx",
    "args": ["tsx", "/Users/jasonbelcher/Documents/code/audio-forge/mcp/src/index.ts"],
    "env": {}
  }
}
```

**Claude Desktop** — Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "audioforge": {
      "command": "npx",
      "args": ["tsx", "/Users/jasonbelcher/Documents/code/audio-forge/mcp/src/index.ts"]
    }
  }
}
```

**Smoke test**: In Claude Code, run `/mcp` — should show `audioforge` as connected.

**Success**: `search_library` tool returns results when queried.

---

## 7. Haiku Prompt Wrapper Template

Use this template when delegating task cards to Claude Haiku:

```
You are implementing part of an MCP server for AudioForge.

PROJECT CONTEXT:
- Location: /Users/jasonbelcher/Documents/code/audio-forge/mcp/
- Language: TypeScript (strict mode, ES2020, ESM)
- Imports use .js extensions (ESM convention)
- Use process.stderr.write() for logging (stdout is MCP protocol)
- Database: better-sqlite3 (synchronous)
- External tools: ffmpeg, aubio, demucs, basic-pitch
- Audio files in: ~/Library/Application Support/audioforge/media/

TASK: {task_id} — {task_title}

{paste the full task card here}

RULES:
- Create/edit ONLY the files listed in the task card
- Each file MUST be under 80 lines
- Do not install additional dependencies beyond package.json
- All imports must use .js extension
- Use Zod for tool input validation
- Handle errors with descriptive messages
- No console.log — use process.stderr.write for any logging

When done, confirm: "Task complete. Success criteria met: {criteria}"
```

---

## 8. Phase Summary

| Phase | Tasks | Description | Est. Time |
|-------|-------|-------------|-----------|
| 0 | T0.1–T0.4 | Project scaffold | ~15 min |
| 1 | T1.1–T1.3 | Database & asset access | ~20 min |
| 2 | T2.1–T2.2 | Search & discovery | ~15 min |
| 3 | T3.1–T3.3 | Audio analysis | ~20 min |
| 4 | T4.1–T4.3 | Audio processing & effects | ~25 min |
| 5 | T5.1–T5.4 | AI & advanced processing | ~25 min |
| 6 | T6.1–T6.2 | Hardware integration | ~20 min |
| 7 | T7.1–T7.3 | Utility tools | ~20 min |
| 8 | T8.1–T8.4 | MCP wiring | ~30 min |
| 9 | T9.1–T9.2 | Assembly & integration | ~20 min |
| **Total** | **30 tasks** | | **~3.5 hours** |

---

## 9. Tool Inventory (46 tools)

### Library & Search (6)
`search_library`, `filter_assets`, `get_asset`, `update_tags`, `delete_asset`, `import_file`

### Analysis (4)
`analyze_bpm`, `analyze_key`, `analyze_audio`, `get_metadata`

### Processing (8)
`convert_format`, `trim_audio`, `normalize_audio`, `apply_fade`, `reverse_audio`, `pitch_shift`, `time_stretch`, `remove_silence`

### Mastering (2)
`master_audio`, `analyze_loudness`

### Advanced (5)
`separate_stems`, `audio_to_midi`, `generate_audio`, `detect_loops`, `extract_loop`

### Harmonic (2)
`get_compatible_keys`, `find_compatible_assets`

### Collections & Projects (5)
`create_collection`, `add_to_collection`, `remove_from_collection`, `create_project`, `update_project`

### YouTube (2)
`youtube_info`, `youtube_download`

### Hardware (4)
`sp404_export_kit`, `sp404_detect_sd`, `koala_export_kit`, `emx1_export_midi`

### Watch Folders (3)
`add_watch_folder`, `remove_watch_folder`, `list_watch_folders`

### Prompts (4)
`project_context`, `mixing_assistant`, `production_workflow`, `asset_analysis`

### Resources (5)
`audioforge://library`, `audioforge://asset/{id}`, `audioforge://collections`, `audioforge://projects`, `audioforge://health`

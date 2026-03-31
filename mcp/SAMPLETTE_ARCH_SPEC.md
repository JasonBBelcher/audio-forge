# AudioForge Samplette: Architecture & Design Specification

> **Codename**: Samplette
> **Purpose**: Reverse-engineer [samplette.io](https://samplette.io) functionality — random music discovery, filtering, and sampling — integrated natively into AudioForge (Electron) and the MCP server.
> **Date**: 2026-03-31

---

## 1. Feature Overview

### What Samplette.io Does
Samplette is a "digital crate-digging" tool that surfaces random, obscure music from YouTube for producers and beatmakers to sample. Core features:

- **🎲 Random Shuffle** — One-click discovery of random YouTube music videos
- **🔍 Advanced Filters** — Genre, style, region, year range, tempo/BPM, musical key, time signature, max view count (to find obscure tracks)
- **📊 Rich Metadata** — Artist, release, year, channel, views, key, tempo, genre, style, region, label, copyright
- **⭐ Favorites & Playlists** — Save, organize, and export discovered tracks
- **📝 Notes** — Annotate discoveries with sampling ideas
- **🎵 Playback Controls** — Skip, rewind, random start times, configurable auto-advance
- **📜 History** — Last 100 discovered tracks

### What We're Building (Superset)
Everything above, PLUS:

- **📋 Batch URL Processing** — Drop a list of YouTube URLs for bulk import & analysis
- **🎯 One-Click Sample** — Download → analyze (BPM/key) → import to library in one action
- **🔪 Stem Separation** — Instant demucs stem split on discovered tracks
- **🎹 Audio-to-MIDI** — Convert discovered melodies to MIDI
- **🔄 Camelot Matching** — Find compatible tracks by harmonic key
- **🤖 MCP Integration** — All discovery features exposed as MCP tools for Claude agents
- **📱 Hardware Export** — Direct export to SP-404/Koala from discovery results

---

## 2. Discovery Engine Architecture

### 2.1 The Randomization Problem

YouTube has no "random" endpoint. Samplette-style tools use several techniques to surface obscure content:

#### Strategy 1: Random Search Queries (Primary)
Generate pseudo-random search terms from curated word lists, combined with filters:

```
GENRE_SEEDS = {
  soul: ["soul", "northern soul", "deep soul", "southern soul", "sweet soul"],
  funk: ["funk", "deep funk", "p-funk", "afro funk", "rare funk"],
  jazz: ["jazz", "modal jazz", "spiritual jazz", "ethio jazz", "rare jazz"],
  afrobeat: ["afrobeat", "afro", "highlife", "jùjú"],
  latin: ["latin", "boogaloo", "salsa", "cumbia", "tropicalia"],
  disco: ["disco", "boogie", "italo disco", "space disco"],
  psychedelic: ["psych", "psychedelic", "acid rock", "krautrock"],
  library: ["library music", "KPM", "de wolfe", "bruton"],
  soundtrack: ["OST", "film score", "soundtrack", "bande originale"],
  reggae: ["reggae", "dub", "rocksteady", "dancehall", "lovers rock"],
  hiphop: ["hip hop instrumental", "boom bap", "lo-fi", "rap"],
  electronic: ["synth", "electro", "breakbeat", "ambient", "techno"],
  world: ["world music", "ethno", "tribal", "folk"],
  rock: ["garage rock", "surf rock", "prog rock", "post-punk"],
  rnb: ["r&b", "rhythm and blues", "quiet storm", "new jack swing"],
  gospel: ["gospel", "spiritual", "church", "choir"],
  blues: ["blues", "delta blues", "chicago blues", "electric blues"],
  country: ["country", "honky tonk", "outlaw country", "bluegrass"],
  classical: ["classical", "baroque", "romantic", "chamber music"],
}

OBSCURITY_MODIFIERS = ["rare", "obscure", "unknown", "forgotten", "unreleased", "private press", "45rpm", "deep cut"]

DECADE_MODIFIERS = ["60s", "70s", "80s", "90s", "2000s"]

REGION_MODIFIERS = ["japanese", "brazilian", "turkish", "thai", "korean", "nigerian", "colombian", "indian", "greek", "peruvian", "ethiopian", "ghanaian", "congolese", "indonesian", "vietnamese"]
```

**Query construction**: Combine `genre_seed + obscurity_modifier + decade + region` with randomization.

#### Strategy 2: YouTube Data API Search with Filters
Use YouTube Data API v3 `search.list` with constrained parameters:

```typescript
{
  part: "snippet",
  type: "video",
  q: generatedQuery,
  videoCategoryId: "10",        // Music category
  publishedBefore: "2005-01-01T00:00:00Z",  // Older = more obscure
  publishedAfter: "1970-01-01T00:00:00Z",
  maxResults: 50,
  order: "relevance",           // or "date" for variety
  regionCode: "US",             // configurable
  relevanceLanguage: "en",      // configurable
}
```

Then randomly select from results, weighted toward lower view counts.

#### Strategy 3: View Count Filtering (Obscurity Dial)
After fetching results, use `videos.list` to get statistics, then filter:

```typescript
// Obscurity levels
MAINSTREAM:  > 1,000,000 views
POPULAR:     100,000 - 1,000,000
MODERATE:    10,000 - 100,000
OBSCURE:     1,000 - 10,000
DEEP_CUT:    100 - 1,000
FORGOTTEN:   0 - 100
```

#### Strategy 4: Metadata Enrichment via External APIs (Optional/Future)

| API | Purpose | Rate Limit | Cost |
|-----|---------|------------|------|
| **Discogs** | Genre/style/year/label metadata | 60/min (auth) | Free |
| **MusicBrainz** | Artist/release/recording data | 1/sec | Free |
| **AcousticBrainz** | BPM/key/mood analysis | Deprecated (use local) | N/A |
| **Last.fm** | Tags, similar artists | 5/sec | Free |

For MVP, we use **YouTube Data API + local analysis (aubio/ffprobe)** only.
External metadata APIs are Phase 2 enhancements.

#### Strategy 5: yt-dlp Fallback (No API Key Required)
When no YouTube API key is configured, use yt-dlp search:

```bash
yt-dlp --dump-json "ytsearch50:rare funk 70s vinyl" --flat-playlist
```

This returns video metadata without downloading, no API key needed. Slower but free and unlimited.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App (UI)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ SampletteView│  │DiscoveryPanel│  │FilterControls │  │
│  │   (main)     │  │  (results)   │  │(genre/year/bpm│  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│  ┌──────┴─────────────────┴───────────────────┴───────┐  │
│  │              IPC Bridge (preload.ts)                │  │
│  └────────────────────────┬───────────────────────────┘  │
├───────────────────────────┼─────────────────────────────┤
│                    Main Process                          │
│  ┌────────────────────────┴───────────────────────────┐  │
│  │           DiscoveryService (NEW)                    │  │
│  │  ┌─────────────┐ ┌──────────┐ ┌────────────────┐   │  │
│  │  │QueryGenerator│ │YouTube   │ │MetadataEnricher│   │  │
│  │  │             │ │Fetcher   │ │                │   │  │
│  │  └─────────────┘ └──────────┘ └────────────────┘   │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │YouTubeService    │  │AnalysisPipeline (existing)   │  │
│  │(existing,extended│  │  BPM → Key → Metadata        │  │
│  └──────────────────┘  └──────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                     MCP Server                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  discovery_random  │  discovery_filter             │  │
│  │  discovery_batch   │  discovery_history             │  │
│  │  discovery_favorites│ discovery_playlist            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                     Database                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  discoveries │ favorites │ playlists │ play_history│  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema (New Tables)

```sql
-- Discovered tracks (not yet imported to library)
CREATE TABLE IF NOT EXISTS discoveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  uploader TEXT,
  upload_date TEXT,
  duration INTEGER,
  view_count INTEGER,
  thumbnail_url TEXT,
  description TEXT,

  -- Audio metadata (populated after analysis)
  bpm INTEGER,
  key TEXT,
  time_signature TEXT,
  genre TEXT,
  style TEXT,
  region TEXT,
  year INTEGER,
  label TEXT,

  -- Discovery metadata
  discovered_via TEXT,          -- 'random', 'search', 'batch', 'url'
  search_query TEXT,            -- The query that found this track
  notes TEXT,                   -- User annotations
  is_favorite BOOLEAN DEFAULT 0,
  listen_count INTEGER DEFAULT 0,
  last_listened_at TEXT,

  -- Import tracking
  asset_id INTEGER,             -- FK to assets table (NULL until imported)
  imported_at TEXT,

  created_at TEXT NOT NULL,

  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

-- Discovery playlists
CREATE TABLE IF NOT EXISTS discovery_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

-- Playlist entries (ordered)
CREATE TABLE IF NOT EXISTS discovery_playlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  discovery_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL,

  FOREIGN KEY (playlist_id) REFERENCES discovery_playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (discovery_id) REFERENCES discoveries(id) ON DELETE CASCADE,
  UNIQUE(playlist_id, discovery_id)
);

-- Search/filter presets (save filter combinations)
CREATE TABLE IF NOT EXISTS discovery_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  filters_json TEXT NOT NULL,   -- JSON blob of filter state
  created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discoveries_youtube_id ON discoveries(youtube_id);
CREATE INDEX IF NOT EXISTS idx_discoveries_genre ON discoveries(genre);
CREATE INDEX IF NOT EXISTS idx_discoveries_bpm ON discoveries(bpm);
CREATE INDEX IF NOT EXISTS idx_discoveries_key ON discoveries(key);
CREATE INDEX IF NOT EXISTS idx_discoveries_view_count ON discoveries(view_count);
CREATE INDEX IF NOT EXISTS idx_discoveries_is_favorite ON discoveries(is_favorite);
CREATE INDEX IF NOT EXISTS idx_discoveries_created_at ON discoveries(created_at);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON discovery_playlist_items(playlist_id, position);
```

---

## 5. Service Layer Design

### 5.1 DiscoveryService (NEW — Core Engine)

```typescript
// src/main/services/discovery.service.ts

export interface DiscoveryFilters {
  genres?: string[];          // e.g., ["funk", "soul"]
  styles?: string[];          // e.g., ["deep funk", "northern soul"]
  regions?: string[];         // e.g., ["japanese", "brazilian"]
  yearMin?: number;           // e.g., 1965
  yearMax?: number;           // e.g., 1985
  bpmMin?: number;            // e.g., 90
  bpmMax?: number;            // e.g., 130
  key?: string;               // e.g., "Am"
  maxViews?: number;          // e.g., 10000 (obscurity dial)
  minViews?: number;          // e.g., 100 (skip zero-view junk)
  minDuration?: number;       // seconds — skip intros/clips
  maxDuration?: number;       // seconds — skip full albums
  excludeChannels?: string[]; // block known compilation channels
}

export interface DiscoveryResult {
  youtubeId: string;
  title: string;
  uploader: string;
  uploadDate: string;
  duration: number;
  viewCount: number;
  thumbnailUrl: string;
  description: string;
  discoveredVia: 'random' | 'search' | 'batch' | 'url';
  searchQuery?: string;
}

export class DiscoveryService {
  // Core discovery methods
  async rollDice(filters?: DiscoveryFilters): Promise<DiscoveryResult>;
  async search(query: string, filters?: DiscoveryFilters): Promise<DiscoveryResult[]>;
  async batchProcess(urls: string[]): Promise<DiscoveryResult[]>;

  // History & state
  async getHistory(limit?: number): Promise<Discovery[]>;
  async clearHistory(): void;

  // Favorites
  async toggleFavorite(id: number): Promise<boolean>;
  async getFavorites(): Promise<Discovery[]>;

  // Playlists
  async createPlaylist(name: string, description?: string): Promise<number>;
  async addToPlaylist(playlistId: number, discoveryId: number): Promise<void>;
  async getPlaylist(playlistId: number): Promise<Discovery[]>;
  async listPlaylists(): Promise<DiscoveryPlaylist[]>;
  async removeFromPlaylist(playlistId: number, discoveryId: number): Promise<void>;
  async deletePlaylist(playlistId: number): Promise<void>;

  // Notes
  async updateNotes(id: number, notes: string): Promise<void>;

  // Filter presets
  async savePreset(name: string, filters: DiscoveryFilters): Promise<number>;
  async loadPreset(name: string): Promise<DiscoveryFilters>;
  async listPresets(): Promise<DiscoveryPreset[]>;
  async deletePreset(id: number): Promise<void>;

  // Import to library
  async importToLibrary(id: number, options?: {
    analyze?: boolean;    // run BPM/key detection
    stems?: boolean;      // run stem separation
    midi?: boolean;       // run audio-to-MIDI
    collection?: number;  // add to collection
  }): Promise<number>;    // returns asset_id
}
```

### 5.2 QueryGenerator (Randomization Engine)

```typescript
// src/main/services/discovery/query-generator.ts

export class QueryGenerator {
  // Genre/style/region seed word lists
  private genreSeeds: Map<string, string[]>;
  private obscurityModifiers: string[];
  private decadeModifiers: string[];
  private regionModifiers: string[];

  // Generate a random search query from filters
  generateQuery(filters?: DiscoveryFilters): string;

  // Build YouTube API search params
  buildSearchParams(query: string, filters?: DiscoveryFilters): YouTubeSearchParams;

  // Weighted random selection from results (favor low view counts)
  selectRandom(results: SearchResult[], maxViews?: number): SearchResult;
}
```

### 5.3 YouTubeFetcher (API Abstraction)

```typescript
// src/main/services/discovery/youtube-fetcher.ts

export class YouTubeFetcher {
  // Two modes: API key (fast, rate-limited) or yt-dlp (slow, unlimited)
  private mode: 'api' | 'yt-dlp';

  // Search with YouTube Data API v3
  async searchAPI(params: YouTubeSearchParams): Promise<SearchResult[]>;

  // Fallback: search via yt-dlp (no API key needed)
  async searchYtDlp(query: string, maxResults: number): Promise<SearchResult[]>;

  // Get detailed video info (view count, full metadata)
  async getVideoDetails(videoIds: string[]): Promise<VideoDetails[]>;

  // Detect available mode on startup
  async detectMode(): Promise<'api' | 'yt-dlp'>;
}
```

---

## 6. MCP Tools (New)

### 6.1 Discovery Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `discovery_roll` | Roll the dice — get a random track | `filters?` (genre, year, bpm, key, maxViews, region) |
| `discovery_search` | Search with custom query + filters | `query`, `filters?`, `limit?` |
| `discovery_batch` | Process a list of YouTube URLs | `urls[]` |
| `discovery_info` | Get enriched info for a YouTube URL | `url` |
| `discovery_import` | Import a discovered track to library | `discovery_id`, `analyze?`, `stems?`, `midi?` |
| `discovery_history` | View recent discoveries | `limit?` |
| `discovery_favorites` | List all favorited discoveries | — |
| `discovery_toggle_favorite` | Favorite/unfavorite a discovery | `discovery_id` |
| `discovery_add_note` | Add sampling notes to a discovery | `discovery_id`, `notes` |
| `discovery_create_playlist` | Create a discovery playlist | `name`, `description?` |
| `discovery_add_to_playlist` | Add discovery to playlist | `playlist_id`, `discovery_id` |
| `discovery_get_playlist` | Get playlist contents | `playlist_id` |
| `discovery_list_playlists` | List all playlists | — |
| `discovery_save_preset` | Save filter preset | `name`, `filters` |
| `discovery_load_preset` | Load saved filter preset | `name` |
| `discovery_find_compatible` | Find harmonically compatible discoveries | `discovery_id` |

### 6.2 MCP Prompts (New)

```typescript
// Crate digging assistant
{
  name: "crate_digger",
  description: "AI-powered crate digging session — discovers and curates samples",
  arguments: [
    { name: "mood", description: "Vibe: dusty, smooth, heavy, psychedelic, dreamy..." },
    { name: "genre", description: "Genre focus: soul, funk, jazz, etc." },
    { name: "era", description: "Decade: 60s, 70s, 80s, etc." },
    { name: "purpose", description: "What you're making: boom bap beat, lo-fi, house track..." }
  ]
}

// Sample analysis
{
  name: "sample_analyst",
  description: "Analyze a discovered track for sampling potential",
  arguments: [
    { name: "discovery_id", description: "Discovery to analyze" }
  ]
}
```

---

## 7. Electron UI Design

### 7.1 SampletteView (New Component)

```
┌──────────────────────────────────────────────────────────────┐
│  🎲 Samplette                                    [⚙ Settings]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── Filter Bar ────────────────────────────────────────┐   │
│  │ Genre: [Soul ▼]  Year: [1965]─[1985]  BPM: [90]─[130]│   │
│  │ Key: [Any ▼]  Region: [Any ▼]  Max Views: [10,000 ▼] │   │
│  │ Preset: [Deep Funk 70s ▼] [Save] [Clear]              │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─── Now Playing ───────────────────────────────────────┐   │
│  │  ┌──────────┐                                         │   │
│  │  │          │  Rotary Connection - Love Is             │   │
│  │  │ thumbnail│  João Alexandre de Jesus                 │   │
│  │  │          │  5:20  •  1,247 views  •  2012           │   │
│  │  └──────────┘                                         │   │
│  │                                                       │   │
│  │  ▶━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━  3:42 / 5:20       │   │
│  │                                                       │   │
│  │  BPM: 98  Key: Dm  Genre: Soul                        │   │
│  │                                                       │   │
│  │  [⏮] [⏪] [⏸] [⏩] [⏭]  🔊━━━━━━━━                   │   │
│  │                                                       │   │
│  │  [★ Favorite] [📝 Note] [📋 Add to Playlist]          │   │
│  │  [⬇ Import to Library] [🔪 Stems] [🎹 MIDI]           │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│       ┌──────────────────────────────────────┐               │
│       │     🎲  ROLL THE DICE  🎲             │               │
│       └──────────────────────────────────────┘               │
│                                                              │
│  ┌─── Discovery History ─────────────────────────────────┐   │
│  │  ★ Rotary Connection - Love Is          Dm  98bpm  ▶  │   │
│  │    Os Mutantes - A Minha Menina          Gm  112bpm ▶  │   │
│  │  ★ Mulatu Astatke - Yèkèrmo Sèw        Am  95bpm  ▶  │   │
│  │    Khruangbin - Maria También            Em  105bpm ▶  │   │
│  │    Minnie Riperton - Les Fleurs          Cm  88bpm  ▶  │   │
│  │  ─────────────────────────────────────────────────────│   │
│  │  [Show Favorites Only] [Export Playlist] [Clear]      │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─── Batch Import ──────────────────────────────────────┐   │
│  │  Paste YouTube URLs (one per line):                    │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ https://youtube.com/watch?v=...                 │   │   │
│  │  │ https://youtube.com/watch?v=...                 │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │  [Process All] [Import All to Library]                 │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Playback

Embed YouTube video via `<webview>` or use yt-dlp to stream audio preview. For the Electron app, an embedded YouTube player (IFrame API) is simplest and avoids copyright concerns since we're playing through YouTube's player.

For the **sampling workflow** (download + process), use the existing `YouTubeService.downloadWithProgress()`.

---

## 8. Task Cards (Haiku-Compatible)

### Phase 0: Database & Infrastructure

#### T0.1 — Discovery Schema Migration
**Input**: `mcp/src/db-init.ts`
**Task**: Add `discoveries`, `discovery_playlists`, `discovery_playlist_items`, `discovery_presets` tables and indexes from Section 4.
**Output**: Updated `db-init.ts` with new CREATE TABLE statements
**Test**: Server starts, tables exist in SQLite
**LOC**: ~60

#### T0.2 — Discovery Query Functions
**Input**: Schema from T0.1
**Task**: Create `mcp/src/queries/discoveries.ts` with CRUD functions:
- `insertDiscovery(data)` → `number`
- `getDiscoveryById(id)` → `Discovery | undefined`
- `getDiscoveryByYoutubeId(ytId)` → `Discovery | undefined`
- `listDiscoveries(limit)` → `Discovery[]`
- `getFavorites()` → `Discovery[]`
- `toggleFavorite(id)` → `boolean`
- `updateNotes(id, notes)` → `void`
- `updateDiscoveryMetadata(id, data)` → `void`
- `linkAsset(discoveryId, assetId)` → `void`
- `deleteDiscovery(id)` → `void`

**Output**: `mcp/src/queries/discoveries.ts`
**Test**: Unit tests for each function
**LOC**: ~120

#### T0.3 — Playlist Query Functions
**Input**: Schema from T0.1
**Task**: Create `mcp/src/queries/discovery-playlists.ts` with:
- `createPlaylist(name, description?)` → `number`
- `listPlaylists()` → `Playlist[]`
- `getPlaylistItems(playlistId)` → `Discovery[]`
- `addToPlaylist(playlistId, discoveryId)` → `void`
- `removeFromPlaylist(playlistId, discoveryId)` → `void`
- `reorderPlaylist(playlistId, discoveryId, newPosition)` → `void`
- `deletePlaylist(id)` → `void`

**Output**: `mcp/src/queries/discovery-playlists.ts`
**Test**: Unit tests
**LOC**: ~90

#### T0.4 — Preset Query Functions
**Input**: Schema from T0.1
**Task**: Create `mcp/src/queries/discovery-presets.ts` with:
- `savePreset(name, filters)` → `number`
- `loadPreset(name)` → `DiscoveryFilters`
- `listPresets()` → `Preset[]`
- `deletePreset(id)` → `void`

**Output**: `mcp/src/queries/discovery-presets.ts`
**Test**: Unit tests
**LOC**: ~50

---

### Phase 1: Discovery Engine

#### T1.1 — Genre Seed Word Lists
**Input**: Genre taxonomy from Section 2.1
**Task**: Create `mcp/src/discovery/genre-seeds.ts` exporting:
- `GENRE_SEEDS: Record<string, string[]>` — 19 genre categories with 4-6 sub-styles each
- `OBSCURITY_MODIFIERS: string[]`
- `DECADE_MODIFIERS: string[]`
- `REGION_MODIFIERS: string[]`
- `getAvailableGenres()` → `string[]`
- `getAvailableRegions()` → `string[]`

**Output**: `mcp/src/discovery/genre-seeds.ts`
**Test**: Verify all genres have seeds, no empty arrays
**LOC**: ~120

#### T1.2 — Query Generator
**Input**: Genre seeds from T1.1, `DiscoveryFilters` interface
**Task**: Create `mcp/src/discovery/query-generator.ts`:
- `generateRandomQuery(filters?)` → `string` — Combines random genre seed + optional modifiers
- `buildYtDlpSearchArgs(query, maxResults)` → `string[]` — Build yt-dlp search command args
- Uses `crypto.randomInt()` for unbiased random selection
- Respects all filter fields to narrow search terms

**Output**: `mcp/src/discovery/query-generator.ts`
**Test**: Generated queries contain expected genre terms, modifiers applied correctly
**LOC**: ~80

#### T1.3 — YouTube Fetcher (yt-dlp Mode)
**Input**: Query generator from T1.2, existing `process-runner.ts`
**Task**: Create `mcp/src/discovery/youtube-fetcher.ts`:
- `searchVideos(query, maxResults)` → `SearchResult[]` — Uses `yt-dlp "ytsearch{n}:{query}" --dump-json --flat-playlist`
- `getVideoDetails(youtubeId)` → `VideoDetails` — Full metadata via `yt-dlp -j`
- `getMultipleDetails(youtubeIds[])` → `VideoDetails[]` — Batch metadata
- Parse and normalize yt-dlp JSON output to consistent interface
- Timeout handling (30s search, 15s per detail)

**Output**: `mcp/src/discovery/youtube-fetcher.ts`
**Test**: Mock yt-dlp output, verify parsing
**LOC**: ~100

#### T1.4 — Discovery Service (Core)
**Input**: T0.2, T0.3, T1.2, T1.3, existing analysis tools
**Task**: Create `mcp/src/discovery/discovery-service.ts`:
- `rollDice(filters?)` → `DiscoveryResult` — Generate query → search → random select → store in DB → return
- `search(query, filters?, limit?)` → `DiscoveryResult[]`
- `processUrl(url)` → `DiscoveryResult` — Direct URL → fetch info → store
- `batchProcess(urls[])` → `DiscoveryResult[]` — Process multiple URLs
- `importToLibrary(discoveryId, options?)` → `number` (asset_id) — Download → analyze → insert asset → link
- Dedup: check `youtube_id` before inserting
- View count filtering: discard results exceeding `maxViews`

**Output**: `mcp/src/discovery/discovery-service.ts`
**Test**: Integration tests with mocked fetcher
**LOC**: ~200

---

### Phase 2: MCP Tool Wiring

#### T2.1 — Discovery MCP Tools (Roll & Search)
**Input**: Discovery service from T1.4
**Task**: Create `mcp/src/tools-discovery.ts` and register with MCP server:
- `discovery_roll` — Roll the dice with optional filters
- `discovery_search` — Search with query + filters
- `discovery_batch` — Process URL list
- `discovery_info` — Get info for single URL
- `discovery_import` — Import discovery to library (with optional analyze/stems/midi)
- All tools use Zod schemas for parameter validation

**Output**: `mcp/src/tools-discovery.ts`
**Test**: Tool registration, parameter validation
**LOC**: ~180

#### T2.2 — Discovery MCP Tools (Organization)
**Input**: Query functions from T0.2, T0.3, T0.4
**Task**: Add to `mcp/src/tools-discovery.ts`:
- `discovery_history` — List recent discoveries
- `discovery_favorites` — List favorites
- `discovery_toggle_favorite` — Toggle favorite status
- `discovery_add_note` — Add/update notes
- `discovery_create_playlist` — Create playlist
- `discovery_add_to_playlist` — Add to playlist
- `discovery_get_playlist` — Get playlist contents
- `discovery_list_playlists` — List all playlists
- `discovery_save_preset` — Save filter preset
- `discovery_load_preset` — Load preset
- `discovery_find_compatible` — Find harmonically compatible tracks (uses Camelot)

**Output**: Updated `mcp/src/tools-discovery.ts`
**Test**: All tool registrations verified
**LOC**: ~200

#### T2.3 — MCP Prompts (Crate Digger)
**Input**: Existing prompts pattern from `mcp/src/prompts.ts`
**Task**: Add new prompts:
- `crate_digger` — AI crate digging session prompt
- `sample_analyst` — Analyze track for sampling potential

**Output**: Updated `mcp/src/prompts.ts`
**Test**: Prompts registered and callable
**LOC**: ~60

#### T2.4 — MCP Resources (Discovery)
**Input**: Existing resource pattern from `mcp/src/resources.ts`
**Task**: Add new resources:
- `audioforge://discoveries` — Recent discovery list
- `audioforge://discovery/{id}` — Single discovery detail
- `audioforge://favorites` — Favorited discoveries
- `audioforge://discovery-playlists` — Playlist index

**Output**: Updated `mcp/src/resources.ts`
**Test**: Resources registered and resolve
**LOC**: ~60

#### T2.5 — Index.ts Wiring
**Input**: tools-discovery.ts from T2.1/T2.2
**Task**: Update `mcp/src/index.ts` to import and register discovery tools:
- `import { registerDiscoveryTools } from './tools-discovery.js'`
- Call `registerDiscoveryTools(server)` in main()
- Update server startup message to include discovery tool count

**Output**: Updated `mcp/src/index.ts`
**LOC**: ~10

---

### Phase 3: Electron Integration

#### T3.1 — Discovery Service (Electron Main Process)
**Input**: Discovery engine from Phase 1
**Task**: Create `src/main/services/discovery.service.ts` for the Electron app:
- Port/adapt MCP discovery service to Electron service pattern
- Use existing `YouTubeService` for downloads
- Use existing `AnalysisPipeline` for BPM/key detection
- Integrate with existing database layer

**Output**: `src/main/services/discovery.service.ts`
**LOC**: ~250

#### T3.2 — IPC Handlers
**Input**: Discovery service from T3.1
**Task**: Create IPC handlers in `src/main/ipc/`:
- `discovery:roll` — Roll the dice
- `discovery:search` — Search with filters
- `discovery:batch` — Batch URL processing
- `discovery:import` — Import to library
- `discovery:history` — Get history
- `discovery:favorites` — Get/toggle favorites
- `discovery:playlists` — CRUD playlists
- `discovery:presets` — CRUD filter presets

**Output**: IPC handler registration
**LOC**: ~120

#### T3.3 — Preload API
**Input**: IPC handlers from T3.2
**Task**: Extend `src/main/preload.ts` to expose discovery API:
```typescript
discovery: {
  roll: (filters?) => ipcRenderer.invoke('discovery:roll', filters),
  search: (query, filters?, limit?) => ...,
  batch: (urls) => ...,
  import: (id, options?) => ...,
  history: (limit?) => ...,
  toggleFavorite: (id) => ...,
  getFavorites: () => ...,
  updateNotes: (id, notes) => ...,
  createPlaylist: (name, desc?) => ...,
  // ... etc
}
```

**Output**: Updated `src/main/preload.ts`
**LOC**: ~60

#### T3.4 — SampletteView Component
**Input**: Preload API from T3.3, UI design from Section 7
**Task**: Create `src/renderer/components/SampletteView.svelte`:
- Filter bar (genre, year, BPM, key, region, max views, presets)
- "Roll the Dice" button with animation
- Now Playing panel with YouTube embed (webview or iframe)
- Metadata display (BPM, key, genre, views)
- Action buttons (favorite, note, import, stems, MIDI)
- Discovery history list with playback controls

**Output**: `src/renderer/components/SampletteView.svelte`
**LOC**: ~350

#### T3.5 — Batch Import Panel
**Input**: Preload API from T3.3
**Task**: Create batch URL input area within SampletteView or as sub-component:
- Textarea for pasting multiple URLs
- URL validation and dedup
- Progress tracking for batch processing
- Results list with import actions

**Output**: Component within SampletteView
**LOC**: ~100

#### T3.6 — Sidebar Integration
**Input**: SampletteView from T3.4
**Task**: Add "Samplette" entry to `Sidebar.svelte` navigation
**Output**: Updated `Sidebar.svelte`
**LOC**: ~10

---

### Phase 4: Testing

#### T4.1 — Discovery Query Tests
**Task**: Test all discovery CRUD operations
**LOC**: ~100

#### T4.2 — Query Generator Tests
**Task**: Test random query generation, filter application, edge cases
**LOC**: ~80

#### T4.3 — YouTube Fetcher Tests
**Task**: Test yt-dlp output parsing with mock data
**LOC**: ~80

#### T4.4 — Discovery Service Integration Tests
**Task**: End-to-end tests: roll → discover → favorite → import
**LOC**: ~120

#### T4.5 — MCP Tool Tests
**Task**: Test all discovery MCP tools via server protocol
**LOC**: ~100

---

## 9. Implementation Order

```
Phase 0: Database (T0.1 → T0.2 → T0.3 → T0.4)           ~320 LOC
Phase 1: Engine   (T1.1 → T1.2 → T1.3 → T1.4)           ~500 LOC
Phase 2: MCP      (T2.1 → T2.2 → T2.3 → T2.4 → T2.5)    ~510 LOC
Phase 3: Electron (T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6) ~890 LOC
Phase 4: Testing  (T4.1 → T4.2 → T4.3 → T4.4 → T4.5)    ~480 LOC
                                                    TOTAL: ~2,700 LOC
```

**Phases 0-2** deliver a fully functional MCP-accessible discovery engine.
**Phase 3** adds the Electron UI.
**Phase 4** ensures quality.

Each task card is scoped for a Haiku-class model: single file, clear inputs/outputs, <250 LOC.

---

## 10. Configuration

### YouTube API Key (Optional — Enhances Speed)

```typescript
// Settings: ~/.audioforge/settings.json
{
  "discovery": {
    "youtubeApiKey": null,           // Optional — falls back to yt-dlp search
    "defaultMaxViews": 50000,        // Default obscurity threshold
    "defaultMinDuration": 60,        // Skip clips < 1 min
    "defaultMaxDuration": 600,       // Skip albums > 10 min
    "historyLimit": 100,             // Max history entries
    "autoAnalyze": true,             // Auto BPM/key on import
    "excludeChannels": []            // Block specific uploaders
  }
}
```

### No API Key? No Problem.

The entire system works without a YouTube API key using yt-dlp's search:
```bash
yt-dlp --dump-json --flat-playlist "ytsearch50:rare japanese funk 70s"
```

This is slower (~5s vs ~0.5s) but free, unlimited, and requires zero setup.

---

## 11. Future Enhancements (Post-MVP)

- **Discogs API integration** — Richer genre/label/year metadata
- **MusicBrainz lookup** — Cross-reference artist/release data
- **Waveform preview** — Visual waveform in discovery results (reuse existing `WaveformSparkline`)
- **AI sampling suggestions** — Claude analyzes track structure and suggests sample points
- **Collaborative playlists** — Share discovery playlists via link
- **Auto-Camelot sets** — Build DJ sets from discoveries by harmonic compatibility
- **YouTube playlist import** — Import entire YouTube playlists
- **Spotify/SoundCloud discovery** — Expand beyond YouTube

---

## Sources

- [Samplette.io](https://samplette.io/)
- [Samplette — Natural 20 Review](https://natural20.com/samplette)
- [MusicRadar — Samplette Review](https://www.musicradar.com/news/samplette)
- [MusicTech — Samplette YouTube Sampler](https://musictech.com/news/gear/samplette-youtube-sample-browser/)
- [SampleRoulette](https://www.sampleroulette.io/)
- [YouTube Data API v3 — Search](https://developers.google.com/youtube/v3/docs/search)
- [Discogs API](https://www.discogs.com/developers)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [vTomb — Random Video Generator](https://www.vtomb.com/)
- [ObscureTube](https://obscuretube.com/)

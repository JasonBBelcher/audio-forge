# Changelog

All notable changes to AudioForge are documented here.

---

## [1.2.0] - 2026-03-31

### Added — CrateDigger

A new **CrateDigger** section under the Library sidebar lets you dig for rare and obscure music the way you'd flip through record crates.

- **Roll Dice** — randomized yt-dlp search queries built from genre seeds (funk, soul, jazz, afrobeat, latin, disco, reggae, hip-hop, electronic, world), regional modifiers, and decade filters; results weighted toward low-view-count tracks
- **Genre & Max Views filters** — pin a genre or cap results at Deep Cut (<100), Forgotten (<1K), Obscure (<10K), Moderate (<50K), or Popular (<100K) view counts
- **Compact track card** — clickable YouTube thumbnail, title, artist, duration, view count, BPM/key/genre tags side by side
- **Loading spinner** — animated spinner shown while rolling so the UI stays responsive
- **Favorites & history** — star discoveries, browse full history, toggle to favorites-only view
- **Import to Library** — downloads audio via yt-dlp, converts to WAV, runs BPM and key analysis, adds to library under the YouTube source filter
- **Batch import** — paste multiple YouTube URLs to process several tracks at once
- **Open on YouTube** — thumbnail click opens the video in the system default browser

### Added — Infrastructure

- `discoveries`, `discovery_playlists`, `discovery_playlist_items`, and `discovery_presets` database tables via migration `009_discoveries`
- `DiscoveryService` — IPC-backed service for rolling, history, favorites, playlist management, and import-to-library
- `shell:openExternal` IPC handler (https-only) exposed via preload for opening external URLs safely
- `webviewTag: true` enabled in BrowserWindow for Electron webview support

### Fixed

- **White screen on startup** — replaced fragile `setTimeout(3000)` in `scripts/dev.js` with `waitForFile` polling for the tsup output; Vite's `listen()` resolves when bound so no port polling needed (fixes IPv6 binding mismatch on macOS)
- **System Health false negatives** — `ffprobe` now has an installer entry; demucs health check switched to `--help` flag (avoids 1.8 s Python startup); default tool timeout raised from 1500 ms to 3000 ms; demucs gets a dedicated 5000 ms override
- **Discovery import crash** — `fileService.getFileInfo()` doesn't exist; replaced with `fs.statSync()`. Added missing `import * as fs` to discovery service
- **Download path failures** — output directory now created with `mkdirSync({ recursive: true })`; video title sanitized to strip invalid filename characters; YouTube ID appended to filename to prevent collisions; output path detection falls back to expected path if regex doesn't match
- **Favorites toggle broken** — SQLite returns `is_favorite` as `0`/`1` integers; `getHistory` and `getFavorites` now normalize these to proper booleans
- **CrateDigger imports missing from library YouTube filter** — imports were stored as `source = 'discovery'`; changed to `source = 'youtube'` to match the library filter

### Changed

- Renamed **Samplette** → **CrateDigger** throughout the UI (sidebar label, view header, page title)
- Toggle button label clarified: previously "⭐ Favorites Only" (active state) vs "Show All" (default) — now "⭐ Favorites" (click to filter) vs "Show All" (click to reset), which reads as an action rather than a status

---

## [1.1.0] - 2025-xx-xx

Initial public release with core feature set: Audio Library, Watch Folders, YouTube Import, Audio-to-MIDI, Stem Separation, Loop Detection, Mastering, AI Audio Generation, SP-404 MK2, Koala Sampler, Korg EMX-1, MIDI Library, Collections, Platform Sync.

# AudioForge

**AudioForge** is a desktop app for producers and musicians who want powerful audio tools without the complexity of a full DAW. It runs on Mac, Windows, and Linux — built with Electron so it feels native on any machine.

Whether you're chopping samples, converting audio to MIDI, mastering a track, building kits for your SP-404 or Koala sampler, or digging for obscure records to sample — AudioForge brings it all into one place.

> **v1.2.0** — Introduces **CrateDigger**, a digital crate-digging tool for discovering rare and obscure music on YouTube.

---

## What It Does

### 🎲 CrateDigger *(new in v1.2.0)*
Roll the dice and discover rare, obscure, and forgotten music — the digital equivalent of flipping through record crates. CrateDigger uses yt-dlp to search YouTube with randomized genre, region, and decade combinations weighted toward low-view-count results.

- **Roll Dice** — generates a random search query from genre seeds (funk, soul, jazz, afrobeat, latin, disco, reggae, hip-hop, electronic, world), regional modifiers (Japanese, Brazilian, Turkish, Nigerian...), and decade filters
- **Genre & view filters** — narrow your dig to a specific genre or limit to "deep cuts" (<100 views), "forgotten" (<1K), or "obscure" (<10K)
- **Compact track card** — shows a clickable thumbnail, title, artist, duration, view count, and any detected BPM/key tags
- **Favorites & history** — star tracks to save them, browse your full discovery history, toggle between all discoveries and favorites-only
- **Import to Library** — downloads the audio via yt-dlp, converts to WAV, runs BPM and key analysis, and adds it to your library under the YouTube source filter
- **Batch import** — paste a list of YouTube URLs to process multiple tracks at once
- **Open on YouTube** — click any thumbnail to watch the full video in your default browser

### Audio Library
Your entire sample library in one searchable, sortable view. Import WAV, MP3, FLAC, AIFF, OGG, M4A, or AAC files and AudioForge automatically analyzes each one for BPM and musical key using [aubio](https://aubio.org/). Waveform previews, tagging, and filtering by key, BPM range, or file type make it easy to find the right sound fast.

**Harmonic mixing built in** — keys are mapped to the Camelot Wheel so you can see at a glance which tracks will mix together without clashing.

### Watch Folders
Point AudioForge at a folder and it watches for new files automatically. Drop a sample into your designated folder from anywhere — Finder, a DAW bounce, a download — and it shows up in your library, analyzed and ready to use. No manual importing required.

### YouTube Import
Paste a YouTube URL and AudioForge downloads the audio, extracts it, and adds it to your library with BPM and key already detected. Great for pulling reference tracks, drum breaks, or samples from video.

### Audio-to-MIDI Conversion
Convert any audio file to MIDI using [basic-pitch](https://github.com/spotify/basic-pitch) (Spotify's open-source pitch detection model). AudioForge handles all the Python environment setup automatically — you just pick a file and hit Convert. The resulting MIDI file lands in your MIDI Library, where you can view it on a **piano roll** and preview it with built-in playback.

### Stem Separation
Separate any track into individual stems — **vocals, drums, bass, and other** — using [demucs](https://github.com/facebookresearch/demucs), Meta's music source separation model. Each stem is automatically imported back into your library when it's done. Great for isolating a drum break, pulling acapellas, or studying how a mix was put together.

### Loop Detection
AudioForge finds the best loopable regions in your audio. Using the detected BPM, it identifies beat-aligned loop candidates at 1, 2, 4, and 8 bars, scores them by onset alignment, and lets you preview each one before extracting it as a new file. Useful for turning long samples into tight, clean loops.

### Mastering
A simple but effective mastering chain built on ffmpeg:

- **3-band EQ** — low shelf, mid peak, high shelf, each with adjustable frequency and gain
- **Compressor** — threshold, ratio, attack, release, and makeup gain
- **Loudness normalization** — target LUFS with true peak ceiling (great for hitting Spotify's -14 LUFS or mastering to vinyl/radio standards)

Not a replacement for a professional mastering engineer, but more than enough for polishing demos, finalizing beats, or preparing tracks for distribution.

### AI Audio Generation
Generate audio from text prompts using the Stable Audio model. Describe the sound you want — "dark lo-fi drum loop at 90 BPM" or "warm analog bass stab" — and AudioForge generates it locally on your machine. GPU-accelerated when available, CPU fallback otherwise. Generated audio is added directly to your library.

### SP-404 MK2 Integration
A dedicated kit builder for Roland's SP-404 MK2. Assign samples from your library to any of the 160 pads (10 banks × 16 pads), preview them, edit waveforms, and export the entire kit directly to your SD card in the correct folder structure the hardware expects. AudioForge automatically converts samples to 48kHz/16-bit stereo WAV — the format the SP-404 requires.

### Koala Sampler Integration
Same idea for [Koala Sampler](https://www.koalasampler.com/). Build 64-pad kits (4 banks × 16 pads), auto-convert to the right format (44.1kHz/16-bit stereo WAV), and export to a folder ready to load on your phone or tablet.

### Korg EMX-1 Integration
Connect an EMX-1 Electribe over MIDI to dump pattern data, view and edit patterns, export them as MIDI files, and sync playback.

### MIDI Library
All your MIDI files in one place. Piano roll visualization, playback with a built-in synthesized preview, BPM and time signature display, and the ability to link MIDI files back to the audio they came from.

### Collections
Create named collections to group related assets — a specific project's samples, a sound pack, a set of reference tracks. Add descriptions, organize however makes sense for your workflow.

### Platform Sync
Connect to SoundCloud and other platforms via OAuth to manage and publish your work directly from the app.

---

## Why AudioForge?

Most producers already own multiple tools that don't talk to each other. Your samples live in one folder, your MIDI files somewhere else, your hardware needs manual setup every session. AudioForge is the connective layer — it doesn't try to replace your DAW, it handles everything around it.

- **Analyzing your library** so you always know the BPM and key of every file
- **Converting audio to MIDI** when you hear a melody you want to replay
- **Separating stems** when you want just the drums or just the vocals
- **Building hardware kits** without manually converting file formats
- **Mastering** when you need a finished-sounding track without sending it out

---

## Requirements

AudioForge installs and manages its own dependencies (ffmpeg, aubio, yt-dlp, demucs, basic-pitch). On first launch you'll see a health check that shows what's installed and what needs to be set up — one-click install for everything.

### Minimum (core features)
Most features — library management, BPM/key detection, loop detection, Audio-to-MIDI, mastering, hardware kit building, YouTube import — run fine on modest hardware:

- **OS**: macOS 10.15+, Windows 10, or Ubuntu 20.04+
- **CPU**: Any modern dual-core (Intel Core i5 / AMD Ryzen 5 or equivalent)
- **RAM**: 4GB
- **Disk**: 2GB free for the app; additional space for your sample library
- **GPU**: Not required for core features

### Recommended (stem separation & AI generation)
Stem separation (demucs) and AI audio generation (Stable Audio) are computationally intensive. They will run on CPU but can be very slow — a 3-minute track can take 10–20 minutes to separate on CPU alone.

- **RAM**: 8GB+
- **GPU (NVIDIA)**: Any CUDA-capable card with **4GB+ VRAM** (GTX 1060 6GB or better). 8GB VRAM recommended for Stable Audio generation.
- **GPU (Apple Silicon)**: M1 or later — Metal acceleration is used automatically, making stem separation and generation practical even on base M1 chips.
- **GPU (AMD)**: Not currently supported for GPU acceleration. AMD users will fall back to CPU.

> **No GPU?** Everything still works — stem separation and AI generation just take longer. AudioForge detects your hardware on startup and adjusts accordingly. A progress bar keeps you informed while jobs run.

---

## Installation

Download the latest release for your platform from the [Releases](https://github.com/JasonBBelcher/audio-forge/releases) page:

- **macOS**: `AudioForge-x.x.x-arm64.dmg` (Apple Silicon) or `AudioForge-x.x.x.dmg` (Intel)
- **Windows**: `AudioForge-x.x.x-Setup.exe`
- **Linux**: `AudioForge-x.x.x.AppImage` or `.deb`

On macOS, since the app is not notarized, you may need to right-click → Open the first time.

---

## Building from Source

```bash
git clone https://github.com/JasonBBelcher/audio-forge.git
cd audio-forge
npm install
npm run dev        # development mode
npm run package    # build distributable
```

Requires Node.js 20+.

---

## Tech Stack

| Layer | Technology |
|---|---|
| App framework | Electron + Svelte 5 |
| Database | SQLite (better-sqlite3) |
| Audio processing | ffmpeg |
| BPM & key detection | aubio |
| Stem separation | demucs |
| Audio-to-MIDI | basic-pitch (Spotify) |
| Waveform display | WaveSurfer.js |
| MIDI playback | Tone.js |
| Hardware MIDI | @julusian/midi |
| YouTube download & crate digging | yt-dlp |

---

## License

MIT

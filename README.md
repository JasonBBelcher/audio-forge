# AudioForge

**AudioForge** is a desktop app for producers and musicians who want powerful audio tools without the complexity of a full DAW. It runs on Mac, Windows, and Linux — built with Electron so it feels native on any machine.

Whether you're chopping samples, converting audio to MIDI, mastering a track, or building kits for your SP-404 or Koala sampler, AudioForge brings it all into one place.

---

## What It Does

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

- macOS (Apple Silicon or Intel), Windows 10+, or Linux
- 4GB RAM minimum (8GB+ recommended for stem separation and AI generation)
- ~3GB disk space for the app and models

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
| YouTube download | yt-dlp |

---

## License

MIT

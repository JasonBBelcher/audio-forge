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

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

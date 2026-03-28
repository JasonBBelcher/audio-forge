import { watch, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { extname, join } from 'path';
import type { FileService, Asset } from './file.service.js';
import type { AnalysisPipelineService } from './analysis-pipeline.service.js';

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.aiff', '.ogg', '.m4a', '.aac']);

export class FolderWatcherService {
  private watchers = new Map<string, ReturnType<typeof watch>>();
  private onFileAdded?: (asset: Asset) => void;

  constructor(
    private fileService: FileService,
    private analysisPipelineService: AnalysisPipelineService
  ) {}

  /**
   * Start watching a directory. When a new audio file appears:
   * 1. Import it via fileService.importFile()
   * 2. Analyze it via analysisPipelineService.analyzeAsset()
   * 3. Call onFileAdded callback if set
   *
   * Uses fs.watch with 'rename' event type.
   * Debounce: wait 500ms after file appears before importing (file may still be writing).
   * Only process files with AUDIO_EXTENSIONS.
   * Skip if file already exists in library (fileService.findByPath or similar).
   */
  watchFolder(folderPath: string): void {
    // Don't create duplicate watchers for the same path
    if (this.watchers.has(folderPath)) {
      return;
    }

    // recursive: true watches all subdirectories natively on macOS & Windows
    const watcher = watch(folderPath, { persistent: false, recursive: true }, (eventType, filename) => {
      if (eventType !== 'rename' || !filename) return;

      const ext = extname(filename).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) return;

      const fullPath = join(folderPath, filename);

      // Debounce: wait 800ms for file to finish writing before importing
      setTimeout(async () => {
        if (!existsSync(fullPath)) return; // file was deleted, not added

        try {
          await this.processNewFile(fullPath);
        } catch (error) {
          console.error(`Error processing new file ${fullPath}:`, error);
        }
      }, 800);
    });

    this.watchers.set(folderPath, watcher);

    // Defer scan so it doesn't block app startup
    setImmediate(() => {
      this.scanExistingFiles(folderPath).catch((error) => {
        console.error(`Error scanning folder ${folderPath}:`, error);
      });
    });
  }

  private async scanExistingFiles(folderPath: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(folderPath, { withFileTypes: true });
    } catch {
      return; // folder may have been removed or be inaccessible
    }

    const audioFiles: string[] = [];
    const subdirs: string[] = [];

    for (const entry of entries) {
      const fullPath = join(folderPath, entry.name);
      if (entry.isDirectory()) {
        subdirs.push(fullPath);
      } else if (entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        audioFiles.push(fullPath);
      }
    }

    // Process audio files with a concurrency limit of 3 to avoid overwhelming the system
    const CONCURRENCY = 3;
    for (let i = 0; i < audioFiles.length; i += CONCURRENCY) {
      await Promise.allSettled(
        audioFiles.slice(i, i + CONCURRENCY).map((p) => this.processNewFile(p))
      );
    }

    // Recurse into subdirectories sequentially to keep I/O manageable
    for (const subdir of subdirs) {
      await this.scanExistingFiles(subdir);
    }
  }

  /**
   * Stop watching a specific folder.
   */
  unwatchFolder(folderPath: string): void {
    const watcher = this.watchers.get(folderPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(folderPath);
    }
  }

  /**
   * Stop all watchers.
   */
  unwatchAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  /**
   * Returns list of currently watched folders.
   */
  getWatchedFolders(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Set callback for when a new file is imported.
   */
  setOnFileAdded(cb: (asset: Asset) => void): void {
    this.onFileAdded = cb;
  }

  /**
   * Private: Process a newly detected audio file.
   * 1. Import the file
   * 2. Analyze it
   * 3. Call the onFileAdded callback
   */
  private async processNewFile(filePath: string): Promise<void> {
    // Skip if already in the library (check by path directly, not a full table scan)
    if (this.fileService.findByFilePath(filePath)) return;

    // Import the file — fast: copy + DB insert only
    const asset = await this.fileService.importFile(filePath);

    // Notify immediately so the file appears in the library right away
    if (this.onFileAdded) {
      this.onFileAdded(asset);
    }

    // Analyze in the background — don't block the scan loop
    this.analysisPipelineService.analyzeAsset(asset.id, asset.file_path).catch((err) => {
      console.error(`Analysis failed for ${filePath}:`, err);
    });
  }
}

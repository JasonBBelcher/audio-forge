import { watch, existsSync } from 'fs';
import { extname, join } from 'path';
import type { FileService } from './file.service.js';
import type { AnalysisPipelineService } from './analysis-pipeline.service.js';

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.aiff', '.ogg', '.m4a', '.aac']);

export class FolderWatcherService {
  private watchers = new Map<string, ReturnType<typeof watch>>();
  private onFileAdded?: (assetId: number, filePath: string) => void;

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
  setOnFileAdded(cb: (assetId: number, filePath: string) => void): void {
    this.onFileAdded = cb;
  }

  /**
   * Private: Process a newly detected audio file.
   * 1. Import the file
   * 2. Analyze it
   * 3. Call the onFileAdded callback
   */
  private async processNewFile(filePath: string): Promise<void> {
    // Skip if a file with the same name is already in the library
    const filename = filePath.split('/').pop() ?? filePath;
    const existing = this.fileService.listFiles();
    const alreadyImported = existing.some((a) => {
      const existingName = a.file_path.split('/').pop();
      return existingName === filename;
    });
    if (alreadyImported) return;

    // Import the file into the library
    const asset = await this.fileService.importFile(filePath);

    // Analyze the asset for metadata (BPM, key, duration)
    await this.analysisPipelineService.analyzeAsset(asset.id, asset.file_path);

    // Notify via callback if set
    if (this.onFileAdded) {
      this.onFileAdded(asset.id, asset.file_path);
    }
  }
}

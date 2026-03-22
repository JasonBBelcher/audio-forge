import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { getAppPaths } from './utils/paths.js';
import { YouTubeService } from './services/youtube.service.js';
import { getEnhancedEnv } from './utils/process-runner.js';
import { createDatabase } from './database/connection.js';
import { runMigrations } from './database/migrations/runner.js';
import { ProjectService } from './services/project.service.js';
import { SettingsService } from './services/settings.service.js';
import { QueueService } from './services/queue.service.js';
import { HealthService } from './services/health.service.js';
import { AudioService } from './services/audio.service.js';
import { VideoService } from './services/video.service.js';
import { FileService } from './services/file.service.js';
import { SyncService } from './services/sync.service.js';
import { PlatformService } from './services/platform.service.js';
import { JobExecutor } from './services/job-executor.js';
import { MediaSyncService } from './services/media-sync.service.js';
import { AdapterRegistry } from './services/hardware-adapter.js';
import { KoalaService } from './services/koala.service.js';
import { AnalysisPipelineService } from './services/analysis-pipeline.service.js';
import { registerProjectHandlers } from './ipc/projectHandlers.js';
import { registerSettingsHandlers } from './ipc/settingsHandlers.js';
import { registerHealthHandlers } from './ipc/healthHandlers.js';
import { registerJobHandlers } from './ipc/jobHandlers.js';
import { registerAudioHandlers } from './ipc/audioHandlers.js';
import { registerVideoHandlers } from './ipc/videoHandlers.js';
import { registerAssetHandlers } from './ipc/assetHandlers.js';
import { registerSyncHandlers } from './ipc/syncHandlers.js';
import { registerPlatformHandlers } from './ipc/platformHandlers.js';
import { registerHardwareHandlers } from './ipc/hardwareHandlers.js';
import { registerMediaSyncHandlers } from './ipc/mediaSyncHandlers.js';
import { registerKoalaHandlers } from './ipc/koalaHandlers.js';
import { registerFileHandlers } from './ipc/fileHandlers.js';
import { SP404Service } from './services/sp404.service.js';
import { registerSP404Handlers } from './ipc/sp404Handlers.js';
import { EMX1Service } from './services/emx1.service.js';
import { registerEMX1Handlers } from './ipc/emx1Handlers.js';
import { CollectionService } from './services/collection.service.js';
import { registerCollectionHandlers } from './ipc/collectionHandlers.js';
import { FolderWatcherService } from './services/folder-watcher.service.js';
import { registerWatcherHandlers } from './ipc/watcherHandlers.js';
import { MidiFilesService } from './services/midi-files.service.js';
import { registerMidiHandlers } from './ipc/midiHandlers.js';

let mainWindow: BrowserWindow | null = null;
const youtubeService = new YouTubeService();

// Initialize services with shared database
const paths = getAppPaths();
const db = createDatabase(paths.database);
runMigrations(db);
const projectService = new ProjectService(db);
const settingsService = new SettingsService(db);
const queueService = new QueueService(db);
const healthService = new HealthService();
const audioService = new AudioService();
const videoService = new VideoService();
const fileService = new FileService(db, paths.media);
const syncService = new SyncService(paths.database);
const platformService = new PlatformService(paths.database);
const mediaSyncService = new MediaSyncService();
const adapterRegistry = new AdapterRegistry();
const koalaService = new KoalaService();
const sp404Service = new SP404Service();
const emx1Service = new EMX1Service();
const collectionService = new CollectionService(db);
const midiFilesService = new MidiFilesService(db);
const analysisPipelineService = new AnalysisPipelineService(audioService, fileService);
const folderWatcherService = new FolderWatcherService(fileService, analysisPipelineService);

// Register service handlers
registerProjectHandlers(ipcMain, projectService);
registerSettingsHandlers(ipcMain, settingsService);
registerHealthHandlers(ipcMain, healthService);
registerJobHandlers(ipcMain, queueService);
registerAudioHandlers(ipcMain, audioService);
registerVideoHandlers(ipcMain, videoService);
registerAssetHandlers(ipcMain, fileService);
registerSyncHandlers(ipcMain, syncService);
registerPlatformHandlers(ipcMain, platformService);
registerMediaSyncHandlers(ipcMain, mediaSyncService);
registerHardwareHandlers(ipcMain, adapterRegistry);
registerKoalaHandlers(ipcMain, koalaService);
registerSP404Handlers(ipcMain, sp404Service);
registerEMX1Handlers(ipcMain, emx1Service);
registerCollectionHandlers(ipcMain, collectionService);
registerFileHandlers(ipcMain, fileService, analysisPipelineService, queueService);
// Note: registerWatcherHandlers and registerMidiHandlers are called in createWindow() after mainWindow is set

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createWindow(): void {
  ensureDir(paths.media);
  ensureDir(paths.temp);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AudioForge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for IPC invoke in preload
    },
  });

  // Register watcher and MIDI handlers now that mainWindow exists
  registerWatcherHandlers(ipcMain, folderWatcherService, mainWindow);
  registerMidiHandlers(ipcMain, midiFilesService, mainWindow);

  // Auto-start watching the Koala sync folder if it's configured
  const koalaSyncFolder = settingsService.get('koalaSyncFolder') as string | undefined;
  if (koalaSyncFolder) {
    try {
      folderWatcherService.watchFolder(koalaSyncFolder);
    } catch (error) {
      console.error(`Failed to start watching Koala sync folder: ${koalaSyncFolder}`, error);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── YouTube IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('youtube:getInfo', async (_event, url: string) => {
  return youtubeService.getInfo(url);
});

ipcMain.handle('youtube:download', async (_event, url: string, trackId: string, outputDir: string) => {
  ensureDir(outputDir);
  const jobId = queueService.enqueue('download-youtube', { url, trackId, outputDir });
  return { jobId };
});

// ─── File IPC ─────────────────────────────────────────────────────────────────

ipcMain.handle('files:showOpenDialog', async (_event, options: Electron.OpenDialogOptions) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('files:showSaveDialog', async (_event, options: Electron.SaveDialogOptions) => {
  if (!mainWindow) return { canceled: true, filePath: '' };
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('files:writeFile', async (_event, filePath: string, data: Uint8Array) => {
  await fs.promises.writeFile(filePath, Buffer.from(data));
});

ipcMain.handle('files:getMediaDir', () => {
  return getAppPaths().media;
});

ipcMain.handle('files:readAsArrayBuffer', async (_event, filePath: string) => {
  const buf = fs.readFileSync(filePath);
  // Return as Uint8Array — transfers cleanly over IPC
  return buf;
});

// ─── Job Executor ─────────────────────────────────────────────────────────────

let jobExecutor: JobExecutor | null = null;

function setupJobExecutor(window: BrowserWindow): void {
  // Set up adapter registry context
  adapterRegistry.setContext({
    db,
    mediaDir: paths.media,
    tempDir: paths.temp,
    emit: (channel: string, data: unknown) => {
      window.webContents.send(channel, data);
    },
  });

  // Create job handlers map with injected services
  const jobHandlers = new Map<string, any>([
    ['download-youtube', async (job: any, onProgress: Function, signal?: AbortSignal) => {
      const { url, trackId, outputDir } = job.payload as {
        url: string; trackId: string; outputDir: string;
      };
      ensureDir(outputDir as string);

      const result = await youtubeService.downloadWithProgress(url as string, outputDir as string, {
        trackId: trackId as string,
        onProgress: (progress) => {
          onProgress(progress.percent, 'downloading');
          // Also emit youtube:progress for the modal's existing subscription
          if (mainWindow) {
            mainWindow.webContents.send('youtube:progress', { trackId, ...progress });
          }
        },
        signal,
      });

      return { filePath: result.filePath };
    }],
    ['convert-audio', async (job: any, onProgress: Function) => {
      const { inputPath, outputFormat, options } = job.payload;
      return audioService.convertFormat(inputPath, outputFormat, options);
    }],
    ['analyze-audio', async (job: any, onProgress: Function) => {
      const { assetId, filePath } = job.payload;
      onProgress(10, 'analyzing BPM');
      const results = await analysisPipelineService.analyzeAsset(assetId, filePath);
      onProgress(100, 'completed');
      return results;
    }],
    ['analyze-audio-all', async (job: any, onProgress: Function) => {
      onProgress(10, 'starting batch analysis');
      await analysisPipelineService.analyzeAll();
      onProgress(100, 'batch analysis completed');
      return { success: true };
    }],
    ['separate-stems', async (job: any, onProgress: Function) => {
      const { filePath, options } = job.payload;
      return audioService.separateStems(filePath, options);
    }],
    ['sync-media', async (job: any, onProgress: Function) => {
      const { videoPath, audioPath, outputPath } = job.payload as any;
      onProgress(10, 'finding offset');
      const { offsetSec } = await mediaSyncService.findOffset(videoPath, audioPath);
      onProgress(50, 'syncing');
      const result = await mediaSyncService.syncAudioWithVideo(videoPath, audioPath, offsetSec, outputPath);
      onProgress(100, 'done');
      return result as any;
    }],
  ]);

  // Create executor with emit callback to send events to renderer
  jobExecutor = new JobExecutor(queueService, jobHandlers, (channel: string, data: unknown) => {
    window.webContents.send(channel, data);
  });

  jobExecutor.start(2000);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  if (mainWindow) {
    setupJobExecutor(mainWindow);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// Clean up watchers on app quit
app.on('before-quit', () => {
  folderWatcherService.unwatchAll();
});

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
import { registerProjectHandlers } from './ipc/projectHandlers.js';
import { registerSettingsHandlers } from './ipc/settingsHandlers.js';
import { registerHealthHandlers } from './ipc/healthHandlers.js';
import { registerJobHandlers } from './ipc/jobHandlers.js';

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

// Register service handlers
registerProjectHandlers(ipcMain, projectService);
registerSettingsHandlers(ipcMain, settingsService);
registerHealthHandlers(ipcMain, healthService);
registerJobHandlers(ipcMain, queueService);

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

ipcMain.handle('youtube:download', async (event, url: string, trackId: string, outputDir: string) => {
  ensureDir(outputDir);
  // Use %(id)s so yt-dlp controls the final name; we scan for the result after
  const outputTemplate = path.join(outputDir, `${trackId}.%(ext)s`);

  return new Promise<{ success: boolean; filePath: string; error?: string }>((resolve) => {
    // Build args manually for audio-only extraction
    const args = [
      '-x',
      '--audio-format', 'wav',
      '--audio-quality', '0',
      '--no-playlist',
      '-o', outputTemplate,
      url,
    ];

    const proc = spawn('yt-dlp', args, { env: getEnhancedEnv() });
    let stderr = '';
    let lastFile = '';

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      // Capture output filename from yt-dlp
      const destMatch = text.match(/\[ExtractAudio\] Destination: (.+)/);
      if (destMatch) lastFile = destMatch[1].trim();

      const lines = text.split('\n');
      for (const line of lines) {
        const progress = youtubeService.parseProgress(line);
        if (progress) {
          event.sender.send('youtube:progress', { trackId, ...progress });
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      // Find the actual wav file produced (yt-dlp may name it differently)
      const wavPath = lastFile || path.join(outputDir, `${trackId}.wav`);
      if (code === 0 && fs.existsSync(wavPath)) {
        resolve({ success: true, filePath: wavPath });
      } else {
        // Scan outputDir for any wav matching trackId prefix
        try {
          const files = fs.readdirSync(outputDir).filter(f => f.startsWith(trackId) && f.endsWith('.wav'));
          if (files.length > 0) {
            resolve({ success: true, filePath: path.join(outputDir, files[0]) });
            return;
          }
        } catch {}
        resolve({ success: false, filePath: '', error: stderr || 'Download failed. Is yt-dlp installed? Run: brew install yt-dlp' });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        filePath: '',
        error: err.message.includes('ENOENT')
          ? 'yt-dlp not found. Install with: brew install yt-dlp'
          : err.message,
      });
    });
  });
});

// ─── Audio Analysis IPC ───────────────────────────────────────────────────────

ipcMain.handle('audio:analyzeBPM', async (_event, filePath: string) => {
  return new Promise<{ bpm: number; error?: string }>((resolve) => {
    // Use aubio tempo via aubiotrack, fallback gracefully if not installed
    const proc = spawn('aubiotrack', ['-i', filePath], { env: getEnhancedEnv() });
    const lines: string[] = [];

    proc.stdout.on('data', (d: Buffer) => lines.push(...d.toString().split('\n').filter(Boolean)));
    proc.on('close', (code) => {
      if (code === 0 && lines.length > 1) {
        const times = lines.map(Number).filter(Boolean);
        if (times.length > 1) {
          const intervals = times.slice(1).map((t, i) => t - times[i]);
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          resolve({ bpm: Math.round(60 / avgInterval) });
          return;
        }
      }
      resolve({ bpm: 0, error: 'aubio not available' });
    });
    proc.on('error', () => resolve({ bpm: 0, error: 'aubio not installed' }));
  });
});

ipcMain.handle('audio:analyzeKey', async (_event, filePath: string) => {
  return new Promise<{ key: string; error?: string }>((resolve) => {
    const proc = spawn('aubiokey', ['-i', filePath], { env: getEnhancedEnv() });
    let out = '';
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()));
    proc.on('close', () => resolve({ key: out.trim() || 'Unknown' }));
    proc.on('error', () => resolve({ key: 'Unknown', error: 'aubio not installed' }));
  });
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

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

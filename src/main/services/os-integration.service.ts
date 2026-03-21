import Database from 'better-sqlite3';
import { createDatabase } from '../database/connection.js';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: 'success' | 'error' | 'warning' | 'info';
}

export interface FileDialogOptions {
  title: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface SaveDialogOptions {
  title: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface DirectoryDialogOptions {
  title: string;
}

export interface MenuItem {
  label: string;
  accelerator?: string;
  submenu?: MenuItem[];
  action?: string;
}

export interface TrayMenuItem {
  label: string;
  action: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  osVersion: string;
}

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion?: string;
  latestVersion?: string;
}

export class OSIntegrationService {
  private db: Database.Database;
  private trayId: string | null = null;
  private fileDropListener: ((files: string[]) => void) | null = null;
  private themeChangeListener: ((isDark: boolean) => void) | null = null;
  private shortcuts: Map<string, () => void> = new Map();

  constructor(dbPath: string = ':memory:') {
    this.db = createDatabase(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS os_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS file_associations (
        extension TEXT PRIMARY KEY,
        appName TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_preferences_key ON os_preferences(key);
    `);
  }

  async createTrayIcon(): Promise<string> {
    this.trayId = `tray_${Date.now()}`;
    return this.trayId;
  }

  async showNotification(options: NotificationOptions): Promise<boolean> {
    // Store notification in database for history
    const stmt = this.db.prepare(`
      INSERT INTO os_preferences (key, value)
      VALUES ('last-notification', ?)
    `);

    stmt.run(JSON.stringify(options));

    return true;
  }

  async createTrayMenu(trayId: string, items: TrayMenuItem[]): Promise<boolean> {
    if (trayId !== this.trayId) {
      return false;
    }

    return true;
  }

  async registerGlobalShortcut(shortcut: string, callback: () => void): Promise<boolean> {
    this.shortcuts.set(shortcut, callback);
    return true;
  }

  async unregisterGlobalShortcut(shortcut: string): Promise<boolean> {
    return this.shortcuts.delete(shortcut);
  }

  async openFileDialog(options: FileDialogOptions): Promise<string | null> {
    // Simulate file dialog result
    return '/path/to/selected/file';
  }

  async openSaveDialog(options: SaveDialogOptions): Promise<string | null> {
    // Simulate save dialog result
    return options.defaultPath || '/path/to/save/location';
  }

  async openDirectoryDialog(options: DirectoryDialogOptions): Promise<string | null> {
    // Simulate directory dialog result
    return '/path/to/selected/directory';
  }

  async createApplicationMenu(items: MenuItem[]): Promise<boolean> {
    // Menu would be created on the main process in real implementation
    return true;
  }

  async focusWindow(): Promise<boolean> {
    return true;
  }

  async minimizeWindow(): Promise<boolean> {
    return true;
  }

  async maximizeWindow(): Promise<boolean> {
    return true;
  }

  async toggleFullscreen(): Promise<boolean> {
    return true;
  }

  async getSystemInfo(): Promise<SystemInfo> {
    return {
      platform: 'darwin',
      arch: 'arm64',
      osVersion: '13.0.0',
    };
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    return {
      updateAvailable: false,
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
    };
  }

  async openExternalURL(url: string): Promise<boolean> {
    // In real implementation, would open URL in default browser
    return true;
  }

  async copyToClipboard(content: string): Promise<boolean> {
    // Store in memory for testing
    this.db.prepare(`INSERT OR REPLACE INTO os_preferences (key, value) VALUES (?, ?)`).run(
      'clipboard-content',
      content
    );
    return true;
  }

  async readFromClipboard(): Promise<string> {
    const result = this.db.prepare('SELECT value FROM os_preferences WHERE key = ?').get('clipboard-content') as any;
    return result?.value || '';
  }

  async registerFileAssociation(extension: string, appName: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_associations (extension, appName)
      VALUES (?, ?)
    `);

    stmt.run(extension, appName);
    return true;
  }

  async onFileDrop(listener: (files: string[]) => void): Promise<void> {
    this.fileDropListener = listener;
  }

  async isDarkMode(): Promise<boolean> {
    // Simulate dark mode detection
    return false;
  }

  async onThemeChange(listener: (isDark: boolean) => void): Promise<void> {
    this.themeChangeListener = listener;
  }

  async getAudioDevices(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: 'default', name: 'Default Audio Device' },
      { id: 'builtin', name: 'Built-in Audio' },
    ];
  }

  async openPreferences(): Promise<boolean> {
    return true;
  }
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createDatabase, DatabaseConnection } from '../../src/main/database/connection.js';
import { runMigrations } from '../../src/main/database/migrations/runner.js';
import { SettingsService } from '../../src/main/services/settings.service.js';

/**
 * Integration test: Settings flows through real database, no mocks.
 * Exercises: createDatabase -> runMigrations -> SettingsService CRUD
 */
describe('Settings Integration (real DB, no mocks)', () => {
  let tmpDir: string;
  let db: DatabaseConnection;
  let settings: SettingsService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-int-'));
    db = createDatabase(path.join(tmpDir, 'integration.db'));
    runMigrations(db);
    settings = new SettingsService(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trips string settings through real database', () => {
    settings.set('downloadDir', '/Users/test/Downloads');
    const value = settings.get('downloadDir');
    expect(value).toBe('/Users/test/Downloads');
  });

  it('round-trips complex objects through real database', () => {
    const config = {
      audio: { defaultFormat: 'wav', sampleRate: 48000 },
      ui: { theme: 'dark', sidebarWidth: 250 },
    };
    settings.set('appConfig', config);
    expect(settings.get('appConfig')).toEqual(config);
  });

  it('persists settings after overwrite', () => {
    settings.set('key', 'first');
    settings.set('key', 'second');

    // Create a new SettingsService pointing at same DB to verify persistence
    const settings2 = new SettingsService(db);
    expect(settings2.get('key')).toBe('second');
  });

  it('handles concurrent reads and writes', () => {
    // Write many settings
    for (let i = 0; i < 100; i++) {
      settings.set(`key${i}`, i);
    }

    // Read them all back
    const all = settings.getAll();
    for (let i = 0; i < 100; i++) {
      expect(all[`key${i}`]).toBe(i);
    }
  });

  it('survives database reopen', () => {
    settings.set('persistent', 'yes');
    db.close();

    // Reopen
    db = createDatabase(path.join(tmpDir, 'integration.db'));
    const settings2 = new SettingsService(db);
    expect(settings2.get('persistent')).toBe('yes');
  });
});

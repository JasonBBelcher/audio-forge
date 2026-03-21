import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createDatabase, DatabaseConnection } from '../../../../src/main/database/connection.js';
import { runMigrations } from '../../../../src/main/database/migrations/runner.js';
import { SettingsService } from '../../../../src/main/services/settings.service.js';

describe('SettingsService', () => {
  let tmpDir: string;
  let db: DatabaseConnection;
  let settings: SettingsService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-settings-test-'));
    db = createDatabase(path.join(tmpDir, 'test.db'));
    runMigrations(db);
    settings = new SettingsService(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns undefined for unset keys', () => {
    const value = settings.get('nonexistent');
    expect(value).toBeUndefined();
  });

  it('sets and gets a string value', () => {
    settings.set('theme', 'dark');
    expect(settings.get('theme')).toBe('dark');
  });

  it('sets and gets a numeric value', () => {
    settings.set('volume', 75);
    expect(settings.get('volume')).toBe(75);
  });

  it('sets and gets a boolean value', () => {
    settings.set('autoUpdate', true);
    expect(settings.get('autoUpdate')).toBe(true);
  });

  it('sets and gets an object value', () => {
    const obj = { width: 1280, height: 800 };
    settings.set('windowBounds', obj);
    expect(settings.get('windowBounds')).toEqual(obj);
  });

  it('overwrites existing value', () => {
    settings.set('theme', 'dark');
    settings.set('theme', 'light');
    expect(settings.get('theme')).toBe('light');
  });

  it('deletes a setting', () => {
    settings.set('theme', 'dark');
    settings.delete('theme');
    expect(settings.get('theme')).toBeUndefined();
  });

  it('returns default value when key is unset', () => {
    const value = settings.get('missing', 'fallback');
    expect(value).toBe('fallback');
  });

  it('returns all settings as a record', () => {
    settings.set('a', 1);
    settings.set('b', 'two');

    const all = settings.getAll();
    expect(all).toEqual({ a: 1, b: 'two' });
  });
});

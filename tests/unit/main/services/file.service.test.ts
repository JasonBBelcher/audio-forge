import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createDatabase } from '../../../../src/main/database/connection.js';
import { runMigrations } from '../../../../src/main/database/migrations/runner.js';
import { FileService } from '../../../../src/main/services/file.service.js';

describe('FileService', () => {
  let tmpDir: string;
  let mediaDir: string;
  let db: any;
  let fileService: FileService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-file-test-'));
    mediaDir = path.join(tmpDir, 'media');
    fs.mkdirSync(mediaDir);

    db = createDatabase(path.join(tmpDir, 'test.db'));
    runMigrations(db);
    fileService = new FileService(db, mediaDir);
  });

  afterEach(() => {
    db.close?.();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('imports a file to media directory', async () => {
    // Create a test file
    const testFile = path.join(tmpDir, 'test.wav');
    fs.writeFileSync(testFile, Buffer.from([0x52, 0x49, 0x46, 0x46])); // RIFF header

    const asset = await fileService.importFile(testFile);

    expect(asset.id).toBeDefined();
    expect(asset.name).toBe('test.wav');
    expect(asset.file_type).toBe('wav');
    expect(fs.existsSync(asset.file_path)).toBe(true);
  });

  it('extracts metadata on import', async () => {
    const testFile = path.join(tmpDir, 'test.wav');
    fs.writeFileSync(testFile, Buffer.alloc(100));

    const asset = await fileService.importFile(testFile);

    expect(asset.file_size).toBeGreaterThan(0);
    expect(asset.mime_type).toBeDefined();
  });

  it('lists all non-trashed files', async () => {
    const file1 = path.join(tmpDir, 'file1.mp3');
    const file2 = path.join(tmpDir, 'file2.mp3');
    fs.writeFileSync(file1, Buffer.alloc(100));
    fs.writeFileSync(file2, Buffer.alloc(100));

    await fileService.importFile(file1);
    await fileService.importFile(file2);

    const assets = fileService.listFiles();
    expect(assets.length).toBe(2);
  });

  it('soft-deletes a file to trash', async () => {
    const testFile = path.join(tmpDir, 'test.wav');
    fs.writeFileSync(testFile, Buffer.alloc(100));

    const asset = await fileService.importFile(testFile);
    fileService.deleteFile(asset.id);

    const assets = fileService.listFiles();
    expect(assets.length).toBe(0); // Trashed files not in list

    const trashed = fileService.listFiles({ includeTrash: true });
    expect(trashed.length).toBe(1);
    expect(trashed[0].trashed_at).toBeDefined();
  });

  it('restores a trashed file', async () => {
    const testFile = path.join(tmpDir, 'test.wav');
    fs.writeFileSync(testFile, Buffer.alloc(100));

    const asset = await fileService.importFile(testFile);
    fileService.deleteFile(asset.id);
    fileService.restoreFile(asset.id);

    const assets = fileService.listFiles();
    expect(assets.length).toBe(1);
    expect(assets[0].trashed_at).toBeNull();
  });

  it('searches files by name using FTS5', async () => {
    const file1 = path.join(tmpDir, 'acoustic-guitar.wav');
    const file2 = path.join(tmpDir, 'electric-guitar.mp3');
    const file3 = path.join(tmpDir, 'drums.wav');

    fs.writeFileSync(file1, Buffer.alloc(100));
    fs.writeFileSync(file2, Buffer.alloc(100));
    fs.writeFileSync(file3, Buffer.alloc(100));

    await fileService.importFile(file1);
    await fileService.importFile(file2);
    await fileService.importFile(file3);

    const results = fileService.searchFiles('guitar');
    expect(results.length).toBe(2);
    expect(results.every((a) => a.name.includes('guitar'))).toBe(true);
  });

  it('adds tags to a file', async () => {
    const testFile = path.join(tmpDir, 'test.wav');
    fs.writeFileSync(testFile, Buffer.alloc(100));

    const asset = await fileService.importFile(testFile);
    fileService.addTags(asset.id, ['ambient', 'experimental']);

    const updated = fileService.getFile(asset.id);
    expect(updated?.tags).toContain('ambient');
  });

  it('organizes files with tags', async () => {
    const file1 = path.join(tmpDir, 'drum-loop.wav');
    const file2 = path.join(tmpDir, 'synth-pad.wav');

    fs.writeFileSync(file1, Buffer.alloc(100));
    fs.writeFileSync(file2, Buffer.alloc(100));

    const a1 = await fileService.importFile(file1);
    const a2 = await fileService.importFile(file2);

    fileService.addTags(a1.id, ['drums']);
    fileService.addTags(a2.id, ['synths']);

    const drums = fileService.searchFiles('drums');
    expect(drums.length).toBeGreaterThanOrEqual(1);
  });

  it('returns undefined for nonexistent file', () => {
    const file = fileService.getFile(99999);
    expect(file).toBeUndefined();
  });

  it('gets storage stats', () => {
    const stats = fileService.getStorageStats();
    expect(stats).toHaveProperty('totalSize');
    expect(stats).toHaveProperty('totalFiles');
    expect(typeof stats.totalSize).toBe('number');
  });
});

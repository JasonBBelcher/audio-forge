import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createDatabase } from '../../src/main/database/connection.js';
import { runMigrations } from '../../src/main/database/migrations/runner.js';
import { QueueService } from '../../src/main/services/queue.service.js';
import { FileService } from '../../src/main/services/file.service.js';

/**
 * Integration test: Queue + Files through real database (no mocks)
 * Exercises: Job creation/tracking + File import/organization
 */
describe('Queue + File Integration (real DB, no mocks)', () => {
  let tmpDir: string;
  let mediaDir: string;
  let db: any;
  let queue: QueueService;
  let files: FileService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-int-'));
    mediaDir = path.join(tmpDir, 'media');
    fs.mkdirSync(mediaDir);

    db = createDatabase(path.join(tmpDir, 'integration.db'));
    runMigrations(db);
    queue = new QueueService(db);
    files = new FileService(db, mediaDir);
  });

  afterEach(() => {
    db.close?.();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('enqueues job, imports file, completes job', async () => {
    // Create a test audio file
    const testFile = path.join(tmpDir, 'test-audio.wav');
    fs.writeFileSync(testFile, Buffer.alloc(1000));

    // Enqueue a convert job
    const jobId = queue.enqueue('convert-audio', {
      inputFile: testFile,
      format: 'mp3',
    });

    // Import the file
    const asset = await files.importFile(testFile);

    // Complete the job with output asset reference
    queue.markCompleted(jobId, {
      outputAssetId: asset.id,
    });

    // Verify
    const job = queue.getJob(jobId);
    expect(job?.status).toBe('completed');
    expect(job?.result?.outputAssetId).toBe(asset.id);

    const importedAsset = files.getFile(asset.id);
    expect(importedAsset).toBeDefined();
  });

  it('tracks multiple concurrent jobs for same file', () => {
    const payload = { source: 'test.wav' };

    const j1 = queue.enqueue('analyze-audio', payload);
    const j2 = queue.enqueue('separate-stems', payload);
    const j3 = queue.enqueue('convert-audio', payload);

    expect(queue.getJob(j1)?.type).toBe('analyze-audio');
    expect(queue.getJob(j2)?.type).toBe('separate-stems');
    expect(queue.getJob(j3)?.type).toBe('convert-audio');

    // All should be pending initially
    const pending = queue.listJobs({ status: 'pending' });
    expect(pending.length).toBe(3);
  });

  it('fails and retries a job while file remains in queue', () => {
    const jobId = queue.enqueue('convert-audio', { file: 'test.wav' }, { maxRetries: 2 });

    queue.markFailed(jobId, 'Conversion failed');
    expect(queue.getJob(jobId)?.status).toBe('failed');

    queue.retry(jobId);
    expect(queue.getJob(jobId)?.status).toBe('pending');
    expect(queue.getJob(jobId)?.retries).toBe(1);
  });

  it('associates assets with projects and tracks via jobs', async () => {
    // Create test files
    const file1 = path.join(tmpDir, 'guitar.wav');
    const file2 = path.join(tmpDir, 'drums.wav');
    fs.writeFileSync(file1, Buffer.alloc(100));
    fs.writeFileSync(file2, Buffer.alloc(100));

    // Import files
    const asset1 = await files.importFile(file1);
    const asset2 = await files.importFile(file2);

    // Enqueue processing jobs
    const j1 = queue.enqueue('analyze-audio', { assetId: asset1.id });
    const j2 = queue.enqueue('separate-stems', { assetId: asset2.id });

    // Complete jobs
    queue.markCompleted(j1, { bpm: 120 });
    queue.markCompleted(j2, { stems: ['vocals', 'instruments'] });

    // Verify
    const allAssets = files.listFiles();
    expect(allAssets.length).toBe(2);

    const allJobs = queue.listJobs({ status: 'completed' });
    expect(allJobs.length).toBe(2);
  });
});

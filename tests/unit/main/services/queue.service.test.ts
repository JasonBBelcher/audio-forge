import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createDatabase } from '../../../../src/main/database/connection.js';
import { runMigrations } from '../../../../src/main/database/migrations/runner.js';
import { QueueService, Job, JobType } from '../../../../src/main/services/queue.service.js';

describe('QueueService', () => {
  let tmpDir: string;
  let queue: QueueService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-queue-test-'));
    const db = createDatabase(path.join(tmpDir, 'test.db'));
    runMigrations(db);
    queue = new QueueService(db);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a job with UUID id', () => {
    const jobId = queue.enqueue('download-youtube', { url: 'https://youtube.com/...' });
    expect(typeof jobId).toBe('string');
    expect(jobId.length).toBeGreaterThan(0);
  });

  it('enqueues a job with default priority', () => {
    const jobId = queue.enqueue('convert-audio', { format: 'wav' });
    const job = queue.getJob(jobId);
    expect(job).toBeDefined();
    expect(job?.status).toBe('pending');
    expect(job?.priority).toBeGreaterThanOrEqual(0);
  });

  it('enqueues a job with custom priority', () => {
    const jobId = queue.enqueue('analyze-audio', { file: 'test.wav' }, { priority: 10 });
    const job = queue.getJob(jobId);
    expect(job?.priority).toBe(10);
  });

  it('lists jobs by status', () => {
    queue.enqueue('download-youtube', {});
    queue.enqueue('convert-audio', {});
    const pending = queue.listJobs({ status: 'pending' });
    expect(pending.length).toBe(2);
  });

  it('returns job by id', () => {
    const jobId = queue.enqueue('sync-media', { videoPath: 'v.mp4' });
    const job = queue.getJob(jobId);
    expect(job?.id).toBe(jobId);
    expect(job?.type).toBe('sync-media');
  });

  it('returns undefined for nonexistent job', () => {
    const job = queue.getJob('nonexistent-id');
    expect(job).toBeUndefined();
  });

  it('updates job progress', () => {
    const jobId = queue.enqueue('download-youtube', {});
    queue.updateProgress(jobId, 50, 'downloading');
    const job = queue.getJob(jobId);
    expect(job?.progress).toBe(50);
  });

  it('marks job as completed with result', () => {
    const jobId = queue.enqueue('convert-audio', {});
    queue.markCompleted(jobId, { output: '/path/to/output.wav' });
    const job = queue.getJob(jobId);
    expect(job?.status).toBe('completed');
    expect(job?.result).toEqual({ output: '/path/to/output.wav' });
  });

  it('marks job as failed with error', () => {
    const jobId = queue.enqueue('sync-media', {});
    queue.markFailed(jobId, 'Sync failed: no offset detected');
    const job = queue.getJob(jobId);
    expect(job?.status).toBe('failed');
    expect(job?.error).toContain('Sync failed');
  });

  it('cancels a pending job', () => {
    const jobId = queue.enqueue('download-youtube', {});
    queue.cancel(jobId);
    const job = queue.getJob(jobId);
    expect(job?.status).toBe('cancelled');
  });

  it('retries a failed job', () => {
    const jobId = queue.enqueue('convert-audio', {}, { maxRetries: 3 });
    queue.markFailed(jobId, 'First attempt failed');
    queue.retry(jobId);
    const job = queue.getJob(jobId);
    expect(job?.status).toBe('pending');
    expect(job?.retries).toBe(1);
  });

  it('stops retrying after max retries exceeded', () => {
    const jobId = queue.enqueue('convert-audio', {}, { maxRetries: 1 });
    queue.markFailed(jobId, 'Attempt 1');
    queue.retry(jobId);
    const job1 = queue.getJob(jobId);
    expect(job1?.status).toBe('pending');

    queue.markFailed(jobId, 'Attempt 2');
    queue.retry(jobId);
    const job2 = queue.getJob(jobId);
    expect(job2?.status).toBe('failed');
  });

  it('respects concurrency limits per job type', () => {
    const limit = queue.getConcurrencyLimit('convert-audio');
    expect(limit).toBeGreaterThan(0);
    expect(typeof limit).toBe('number');
  });

  it('counts active jobs by type', () => {
    queue.enqueue('download-youtube', {});
    queue.enqueue('download-youtube', {});
    queue.enqueue('convert-audio', {});

    const downloadCount = queue.getActiveJobCount('download-youtube');
    const convertCount = queue.getActiveJobCount('convert-audio');

    // Initially pending, not active
    expect(downloadCount).toBe(0);
    expect(convertCount).toBe(0);
  });

  it('stores and retrieves job payload', () => {
    const payload = { url: 'https://example.com', format: 'mp3', quality: 'high' };
    const jobId = queue.enqueue('download-youtube', payload);
    const job = queue.getJob(jobId);
    expect(job?.payload).toEqual(payload);
  });
});

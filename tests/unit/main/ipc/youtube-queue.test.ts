import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDatabase } from '../../../../src/main/database/connection.js';
import { runMigrations } from '../../../../src/main/database/migrations/runner.js';
import { QueueService } from '../../../../src/main/services/queue.service.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('YouTube Queue — IPC handler integration', () => {
  let db: any;
  let queueService: QueueService;
  let mockIpcMain: any;
  let handlers: Map<string, Function>;

  beforeEach(() => {
    // Create in-memory database for testing
    db = createDatabase(':memory:');

    // Run migrations to set up schema
    runMigrations(db);

    // Initialize queue service
    queueService = new QueueService(db);

    // Create mock IpcMain
    handlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        handlers.set(channel, handler);
      }),
    };
  });

  it('youtube:download IPC handler enqueues a job and returns jobId', async () => {
    // Register a simple mock handler that enqueues
    mockIpcMain.handle('youtube:download', (_event: any, url: string, trackId: string, outputDir: string) => {
      const jobId = queueService.enqueue('download-youtube', { url, trackId, outputDir });
      return { jobId };
    });

    const handler = handlers.get('youtube:download');
    expect(handler).toBeDefined();

    // Call the handler
    const result = await handler({}, 'https://youtube.com/watch?v=abc', 'track-1', '/tmp/media');

    expect(result).toHaveProperty('jobId');
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId.length).toBeGreaterThan(0);
  });

  it('returned jobId is a valid UUID', async () => {
    mockIpcMain.handle('youtube:download', (_event: any, url: string, trackId: string, outputDir: string) => {
      const jobId = queueService.enqueue('download-youtube', { url, trackId, outputDir });
      return { jobId };
    });

    const handler = handlers.get('youtube:download');
    const result = await handler({}, 'https://youtube.com/watch?v=abc', 'track-1', '/tmp/media');

    // UUID v4 format: 8-4-4-4-12 hex digits
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(result.jobId).toMatch(uuidRegex);
  });

  it('job is in queue with correct payload after download IPC call', async () => {
    mockIpcMain.handle('youtube:download', (_event: any, url: string, trackId: string, outputDir: string) => {
      const jobId = queueService.enqueue('download-youtube', { url, trackId, outputDir });
      return { jobId };
    });

    const handler = handlers.get('youtube:download');
    const result = await handler({}, 'https://youtube.com/watch?v=abc', 'track-1', '/tmp/media');

    const job = queueService.getJob(result.jobId);
    expect(job).toBeDefined();
    expect(job!.type).toBe('download-youtube');
    expect(job!.status).toBe('pending');
    expect(job!.payload.url).toBe('https://youtube.com/watch?v=abc');
    expect(job!.payload.trackId).toBe('track-1');
    expect(job!.payload.outputDir).toBe('/tmp/media');
  });

  it('multiple youtube:download calls create separate jobs', async () => {
    mockIpcMain.handle('youtube:download', (_event: any, url: string, trackId: string, outputDir: string) => {
      const jobId = queueService.enqueue('download-youtube', { url, trackId, outputDir });
      return { jobId };
    });

    const handler = handlers.get('youtube:download');

    const result1 = await handler({}, 'https://youtube.com/watch?v=abc', 'track-1', '/tmp/media');
    const result2 = await handler({}, 'https://youtube.com/watch?v=def', 'track-2', '/tmp/media');

    expect(result1.jobId).not.toBe(result2.jobId);

    const job1 = queueService.getJob(result1.jobId);
    const job2 = queueService.getJob(result2.jobId);

    expect(job1!.payload.trackId).toBe('track-1');
    expect(job2!.payload.trackId).toBe('track-2');
  });

  it('job can be queried by ID after enqueue', async () => {
    mockIpcMain.handle('youtube:download', (_event: any, url: string, trackId: string, outputDir: string) => {
      const jobId = queueService.enqueue('download-youtube', { url, trackId, outputDir });
      return { jobId };
    });

    const handler = handlers.get('youtube:download');
    const result = await handler({}, 'https://youtube.com/watch?v=test', 'test-track', '/tmp');

    // Should be able to get job by ID immediately
    const job = queueService.getJob(result.jobId);
    expect(job).toBeDefined();
    expect(job!.id).toBe(result.jobId);
  });
});

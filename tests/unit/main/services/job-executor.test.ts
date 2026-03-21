import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { QueueService, Job, JobType } from '../../../../src/main/services/queue.service.js';
import { JobExecutor, JobHandler } from '../../../../src/main/services/job-executor.js';

describe('JobExecutor', () => {
  let db: Database.Database;
  let queueService: QueueService;
  let executor: JobExecutor;
  const emitCalls: Array<{ channel: string; data: unknown }> = [];

  const mockEmit = (channel: string, data: unknown) => {
    emitCalls.push({ channel, data });
  };

  beforeEach(() => {
    // Create in-memory SQLite database for testing
    db = new Database(':memory:');

    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        payload TEXT NOT NULL,
        result TEXT,
        error TEXT,
        progress REAL DEFAULT 0,
        retries INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        timeout INTEGER DEFAULT 300000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        updated_at DATETIME,
        completed_at DATETIME
      );
    `);

    queueService = new QueueService(db);
    emitCalls.length = 0;
  });

  afterEach(() => {
    if (executor) {
      executor.stop();
    }
    db.close();
  });

  it('should start polling and stop polling', async () => {
    const handlers = new Map<string, JobHandler>();
    executor = new JobExecutor(queueService, handlers, mockEmit);

    expect(executor['pollTimer']).toBeNull();
    executor.start(100);
    expect(executor['pollTimer']).not.toBeNull();

    executor.stop();
    expect(executor['pollTimer']).toBeNull();
  });

  it('should execute a pending job and mark it completed', async () => {
    let handlerCalled = false;
    const testHandler: JobHandler = async (job, onProgress, signal) => {
      handlerCalled = true;
      return { success: true };
    };

    const handlers = new Map<string, JobHandler>([
      ['download-youtube', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);

    // Enqueue a test job - use a real JobType
    const jobId = queueService.enqueue('download-youtube', { foo: 'bar' });

    // Start executor with fast polling
    executor.start(50);

    // Wait for job to execute
    await vi.waitFor(() => {
      const job = queueService.getJob(jobId);
      return job?.status === 'completed';
    }, { timeout: 2000 });

    expect(handlerCalled).toBe(true);
    const job = queueService.getJob(jobId);
    expect(job?.status).toBe('completed');
    expect(job?.result).toEqual({ success: true });
  });

  it('should emit job:progress events with progress and stage', async () => {
    let progressCallback: ((progress: number, stage?: string) => void) | null = null;

    const testHandler: JobHandler = async (job, onProgress, signal) => {
      progressCallback = onProgress;
      onProgress(25, 'processing');
      return { success: true };
    };

    const handlers = new Map<string, JobHandler>([
      ['analyze-audio', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);
    const jobId = queueService.enqueue('analyze-audio', {});

    executor.start(50);

    await vi.waitFor(() => {
      return emitCalls.some(call => call.channel === 'job:progress');
    }, { timeout: 2000 });

    const progressEvent = emitCalls.find(call => call.channel === 'job:progress');
    expect(progressEvent).toBeDefined();
    expect(progressEvent?.data).toEqual({
      jobId,
      progress: 25,
      stage: 'processing',
    });
  });

  it('should emit job:complete event on success', async () => {
    const testHandler: JobHandler = async (job, onProgress, signal) => {
      return { result: 'success', value: 42 };
    };

    const handlers = new Map<string, JobHandler>([
      ['analyze-audio', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);
    const jobId = queueService.enqueue('analyze-audio', {});

    executor.start(50);

    await vi.waitFor(() => {
      return emitCalls.some(call => call.channel === 'job:complete');
    }, { timeout: 2000 });

    const completeEvent = emitCalls.find(call => call.channel === 'job:complete');
    expect(completeEvent?.data).toEqual({
      jobId,
      result: { result: 'success', value: 42 },
    });
  });

  it('should emit job:failed event on handler error', async () => {
    const testHandler: JobHandler = async (job, onProgress, signal) => {
      throw new Error('Handler failed');
    };

    const handlers = new Map<string, JobHandler>([
      ['analyze-audio', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);
    const jobId = queueService.enqueue('analyze-audio', {});

    executor.start(50);

    await vi.waitFor(() => {
      return emitCalls.some(call => call.channel === 'job:failed');
    }, { timeout: 2000 });

    const failedEvent = emitCalls.find(call => call.channel === 'job:failed');
    expect(failedEvent?.data).toMatchObject({
      jobId,
      error: 'Handler failed',
    });

    const job = queueService.getJob(jobId);
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('Handler failed');
  });

  it('should mark job failed if no handler is registered', async () => {
    const handlers = new Map<string, JobHandler>();
    executor = new JobExecutor(queueService, handlers, mockEmit);
    const jobId = queueService.enqueue('convert-audio', {});

    executor.start(50);

    await vi.waitFor(() => {
      return emitCalls.some(call => call.channel === 'job:failed');
    }, { timeout: 2000 });

    const job = queueService.getJob(jobId);
    expect(job?.status).toBe('failed');
    expect(job?.error).toContain('No handler');
  });

  it('should respect concurrency limits per job type', async () => {
    let activeCount = 0;
    let maxActiveCount = 0;

    const testHandler: JobHandler = async (job, onProgress, signal) => {
      activeCount++;
      maxActiveCount = Math.max(maxActiveCount, activeCount);

      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 100));

      activeCount--;
      return { success: true };
    };

    const handlers = new Map<string, JobHandler>([
      ['limited-job', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);

    // Mock getConcurrencyLimit to return 1 for this type
    const originalLimit = queueService.getConcurrencyLimit;
    vi.spyOn(queueService, 'getConcurrencyLimit').mockReturnValue(1);

    // Enqueue multiple jobs
    const jobIds = [
      queueService.enqueue('analyze-audio', {}),
      queueService.enqueue('analyze-audio', {}),
      queueService.enqueue('analyze-audio', {}),
    ];

    executor.start(50);

    await vi.waitFor(() => {
      return queueService.listJobs({ status: 'completed' }).length === 3;
    }, { timeout: 3000 });

    // With limit of 1, max active should never exceed 1
    expect(maxActiveCount).toBeLessThanOrEqual(1);
  });

  it('should abort job when cancelled externally', async () => {
    let abortSignalReceived: AbortSignal | null = null;
    let handlerCompleted = false;

    const testHandler: JobHandler = async (job, onProgress, signal) => {
      abortSignalReceived = signal;

      return new Promise((resolve, reject) => {
        const checkAbort = setInterval(() => {
          if (signal.aborted) {
            clearInterval(checkAbort);
            reject(new Error('Aborted'));
          }
        }, 10);

        setTimeout(() => {
          clearInterval(checkAbort);
          handlerCompleted = true;
          resolve({ success: true });
        }, 500);
      });
    };

    const handlers = new Map<string, JobHandler>([
      ['analyze-audio', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);
    const jobId = queueService.enqueue('analyze-audio', {});

    executor.start(50);

    // Give job time to start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cancel the job
    queueService.cancel(jobId);

    // Give executor time to process cancellation
    await new Promise(resolve => setTimeout(resolve, 200));

    // The abort signal should be aborted
    expect(abortSignalReceived?.aborted).toBe(true);
    expect(handlerCompleted).toBe(false);
  });

  it('should clean up on stop()', async () => {
    let runningJobAborted = false;

    const testHandler: JobHandler = async (job, onProgress, signal) => {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (signal.aborted) {
            runningJobAborted = true;
            clearInterval(interval);
            resolve({ aborted: true });
          }
        }, 10);

        setTimeout(() => {
          clearInterval(interval);
          resolve({ success: true });
        }, 1000);
      });
    };

    const handlers = new Map<string, JobHandler>([
      ['analyze-audio', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);
    const jobId = queueService.enqueue('analyze-audio', {});

    executor.start(50);

    // Let job start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Stop executor
    executor.stop();

    // Job should be aborted
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(runningJobAborted).toBe(true);
  });

  it('should track running jobs via isRunning()', async () => {
    // Long-running job to keep it in the running map
    let jobStarted = false;
    let jobFinished = false;

    const testHandler: JobHandler = async (job, onProgress, signal) => {
      jobStarted = true;
      // Keep the job running long enough to check
      await new Promise(resolve => setTimeout(resolve, 300));
      jobFinished = true;
      return { success: true };
    };

    const handlers = new Map<string, JobHandler>([
      ['analyze-audio', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);
    const jobId = queueService.enqueue('analyze-audio', {});

    executor.start(50);

    // Give job time to start
    await new Promise(resolve => setTimeout(resolve, 150));

    // Job should have started and should be running
    expect(jobStarted).toBe(true);
    expect(executor.isRunning(jobId)).toBe(true);

    // Wait a bit more for job to finish
    await new Promise(resolve => setTimeout(resolve, 300));

    // Job should be finished and not running
    expect(jobFinished).toBe(true);
    expect(executor.isRunning(jobId)).toBe(false);
  });

  it('should not run more jobs than concurrency limit allows', async () => {
    const activeJobs: string[] = [];
    let maxConcurrent = 0;

    const testHandler: JobHandler = async (job, onProgress, signal) => {
      activeJobs.push(job.id);
      maxConcurrent = Math.max(maxConcurrent, activeJobs.length);

      await new Promise(resolve => setTimeout(resolve, 150));

      const idx = activeJobs.indexOf(job.id);
      if (idx > -1) activeJobs.splice(idx, 1);

      return { success: true };
    };

    const handlers = new Map<string, JobHandler>([
      ['limited-job', testHandler],
    ]);

    executor = new JobExecutor(queueService, handlers, mockEmit);
    vi.spyOn(queueService, 'getConcurrencyLimit').mockReturnValue(2);

    // Enqueue 5 jobs
    for (let i = 0; i < 5; i++) {
      queueService.enqueue('analyze-audio', { index: i });
    }

    executor.start(50);

    await vi.waitFor(() => {
      return queueService.listJobs({ status: 'completed' }).length === 5;
    }, { timeout: 4000 });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});

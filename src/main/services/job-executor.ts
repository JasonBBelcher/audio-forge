import type { Job, JobType } from './queue.service.js';
import type { QueueService } from './queue.service.js';

export type JobHandler = (
  job: Job,
  onProgress: (progress: number, stage?: string) => void,
  signal: AbortSignal
) => Promise<Record<string, unknown>>;

export class JobExecutor {
  private running = new Map<string, AbortController>();
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly queue: QueueService,
    private readonly handlers: Map<string, JobHandler>,
    private readonly emit: (channel: string, data: unknown) => void
  ) {}

  start(intervalMs = 2000): void {
    if (this.pollTimer) return;

    // Poll immediately first (fire and forget)
    void this.poll();

    // Then set up recurring poll
    this.pollTimer = setInterval(async () => {
      await this.poll();
    }, intervalMs);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Abort all running jobs
    for (const controller of this.running.values()) {
      controller.abort();
    }
    this.running.clear();
  }

  isRunning(jobId: string): boolean {
    return this.running.has(jobId);
  }

  private async poll(): Promise<void> {
    // Get all pending jobs
    const pendingJobs = this.queue.listJobs({ status: 'pending' });

    for (const job of pendingJobs) {
      // Check if job is already running
      if (this.running.has(job.id)) {
        continue;
      }

      // Check if job was cancelled while waiting
      const currentJob = this.queue.getJob(job.id);
      if (currentJob?.status === 'cancelled') {
        continue;
      }

      // Check for jobs with no handler and fail them immediately
      if (!this.handlers.has(job.type)) {
        this.queue.markFailed(job.id, 'No handler registered for job type: ' + job.type);
        this.emit('job:failed', {
          jobId: job.id,
          error: 'No handler registered for job type: ' + job.type,
        });
        continue;
      }

      // Check if we can run more jobs of this type
      const limit = this.queue.getConcurrencyLimit(job.type);
      const active = this.queue.getActiveJobCount(job.type);

      if (active < limit) {
        // Start execution
        void this.execute(job);
      }
    }

    // Check for cancelled jobs and abort them
    for (const [jobId, controller] of this.running.entries()) {
      const job = this.queue.getJob(jobId);
      if (job?.status === 'cancelled' && !controller.signal.aborted) {
        controller.abort();
      }
    }
  }

  private async execute(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      // Should not happen since we check in poll(), but just in case
      return;
    }

    // Create abort controller for this job
    const controller = new AbortController();
    this.running.set(job.id, controller);

    try {
      // Mark job as running
      this.queue.markRunning(job.id);

      // Create progress callback
      const onProgress = (progress: number, stage?: string) => {
        this.queue.updateProgress(job.id, progress, stage);
        this.emit('job:progress', {
          jobId: job.id,
          progress,
          stage,
        });
      };

      // Execute handler
      const result = await handler(job, onProgress, controller.signal);

      // Check if was cancelled while executing
      if (controller.signal.aborted) {
        this.queue.markFailed(job.id, 'Job was cancelled');
        this.emit('job:failed', {
          jobId: job.id,
          error: 'Job was cancelled',
        });
        return;
      }

      // Mark as completed
      this.queue.markCompleted(job.id, result);
      this.emit('job:complete', {
        jobId: job.id,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Only mark failed if not cancelled
      if (!controller.signal.aborted) {
        this.queue.markFailed(job.id, errorMessage);
        this.emit('job:failed', {
          jobId: job.id,
          error: errorMessage,
        });
      }
    } finally {
      this.running.delete(job.id);
    }
  }
}

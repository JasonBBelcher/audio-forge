import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerJobHandlers } from '../../../../src/main/ipc/jobHandlers.js';

describe('Job IPC Handlers', () => {
  let mockIpcMain: any;
  let mockQueueService: any;
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    registeredHandlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        registeredHandlers.set(channel, handler);
      }),
    };

    mockQueueService = {
      listJobs: vi.fn().mockReturnValue([]),
      getJob: vi.fn().mockReturnValue(undefined),
      cancel: vi.fn(),
    };
  });

  it('registers jobs:list handler', () => {
    registerJobHandlers(mockIpcMain, mockQueueService);
    expect(registeredHandlers.has('jobs:list')).toBe(true);
  });

  it('registers jobs:getStatus handler', () => {
    registerJobHandlers(mockIpcMain, mockQueueService);
    expect(registeredHandlers.has('jobs:getStatus')).toBe(true);
  });

  it('registers jobs:cancel handler', () => {
    registerJobHandlers(mockIpcMain, mockQueueService);
    expect(registeredHandlers.has('jobs:cancel')).toBe(true);
  });

  describe('jobs:list handler', () => {
    it('calls queueService.listJobs with status filter', () => {
      registerJobHandlers(mockIpcMain, mockQueueService);
      const handler = registeredHandlers.get('jobs:list')!;

      handler(null, 'pending');
      expect(mockQueueService.listJobs).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('calls queueService.listJobs without filter when status is undefined', () => {
      registerJobHandlers(mockIpcMain, mockQueueService);
      const handler = registeredHandlers.get('jobs:list')!;

      handler(null, undefined);
      expect(mockQueueService.listJobs).toHaveBeenCalledWith({});
    });

    it('returns jobs from service', () => {
      const jobs = [
        { id: 'job-1', type: 'download-youtube', status: 'pending' },
        { id: 'job-2', type: 'convert-audio', status: 'running' },
      ];
      mockQueueService.listJobs.mockReturnValue(jobs);

      registerJobHandlers(mockIpcMain, mockQueueService);
      const handler = registeredHandlers.get('jobs:list')!;

      const result = handler(null, 'pending');
      expect(result).toEqual(jobs);
    });
  });

  describe('jobs:getStatus handler', () => {
    it('calls queueService.getJob with job id', () => {
      registerJobHandlers(mockIpcMain, mockQueueService);
      const handler = registeredHandlers.get('jobs:getStatus')!;

      handler(null, 'job-123');
      expect(mockQueueService.getJob).toHaveBeenCalledWith('job-123');
    });

    it('returns job from service', () => {
      const job = { id: 'job-123', type: 'download-youtube', status: 'running' };
      mockQueueService.getJob.mockReturnValue(job);

      registerJobHandlers(mockIpcMain, mockQueueService);
      const handler = registeredHandlers.get('jobs:getStatus')!;

      const result = handler(null, 'job-123');
      expect(result).toEqual(job);
    });

    it('returns undefined for nonexistent job', () => {
      mockQueueService.getJob.mockReturnValue(undefined);

      registerJobHandlers(mockIpcMain, mockQueueService);
      const handler = registeredHandlers.get('jobs:getStatus')!;

      const result = handler(null, 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('jobs:cancel handler', () => {
    it('calls queueService.cancel with job id', () => {
      registerJobHandlers(mockIpcMain, mockQueueService);
      const handler = registeredHandlers.get('jobs:cancel')!;

      handler(null, 'job-123');
      expect(mockQueueService.cancel).toHaveBeenCalledWith('job-123');
    });
  });
});

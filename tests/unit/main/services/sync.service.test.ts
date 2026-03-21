import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService, SyncStatus } from '../../../../src/main/services/sync.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('SyncService', () => {
  let sync: SyncService;

  beforeEach(() => {
    sync = new SyncService(':memory:');
    vi.clearAllMocks();
  });

  it('initializes sync status', async () => {
    const projectId = 'test-project-1';
    const status = await sync.initializeSync(projectId, 'local-storage');

    expect(status).toHaveProperty('id');
    expect(status.projectId).toBe(projectId);
    expect(status.backend).toBe('local-storage');
    expect(status.status).toBe('initialized');
  });

  it('marks project as synced', async () => {
    const projectId = 'test-project-2';
    await sync.initializeSync(projectId, 'cloud');

    const status = await sync.markSynced(projectId);

    expect(status?.status).toBe('synced');
    expect(status?.lastSyncTime).toBeDefined();
  });

  it('marks project as out of sync', async () => {
    const projectId = 'test-project-3';
    await sync.initializeSync(projectId, 'cloud');
    await sync.markSynced(projectId);

    const status = await sync.markOutOfSync(projectId);

    expect(status?.status).toBe('out-of-sync');
    expect(status?.lastSyncTime).toBeDefined();
  });

  it('tracks sync progress', async () => {
    const projectId = 'test-project-4';
    const syncId = await sync.initializeSync(projectId, 'cloud');

    await sync.updateSyncProgress(syncId.id, { progress: 25, stage: 'uploading-assets' });

    const status = await sync.getSyncStatus(projectId);
    expect(status?.progress).toBe(25);
    expect(status?.currentStage).toBe('uploading-assets');
  });

  it('handles sync errors', async () => {
    const projectId = 'test-project-5';
    const syncId = await sync.initializeSync(projectId, 'cloud');
    const error = 'Network timeout during upload';

    await sync.recordSyncError(syncId.id, error);

    const status = await sync.getSyncStatus(projectId);
    expect(status?.status).toBe('failed');
    expect(status?.error).toBe(error);
  });

  it('retrieves sync status for project', async () => {
    const projectId = 'test-project-6';
    await sync.initializeSync(projectId, 'local-storage');

    const status = await sync.getSyncStatus(projectId);

    expect(status).toBeDefined();
    expect(status?.projectId).toBe(projectId);
    expect(status?.backend).toBe('local-storage');
  });

  it('lists all sync sessions for a project', async () => {
    const projectId = 'test-project-7';
    await sync.initializeSync(projectId, 'cloud');
    await sync.initializeSync(projectId, 'cloud');

    const sessions = await sync.listSyncSessions(projectId);

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.every((s) => s.projectId === projectId)).toBe(true);
  });

  it('detects sync conflicts', async () => {
    const projectId = 'test-project-8';
    const syncId = await sync.initializeSync(projectId, 'cloud');

    const conflict = {
      filePath: 'track1.wav',
      localModified: new Date().toISOString(),
      remoteModified: new Date(Date.now() + 1000).toISOString(),
    };

    await sync.recordConflict(syncId.id, conflict);

    const conflicts = await sync.getConflicts(syncId.id);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts.some((c) => c.filePath === 'track1.wav')).toBe(true);
  });

  it('resolves sync conflicts', async () => {
    const projectId = 'test-project-9';
    const syncId = await sync.initializeSync(projectId, 'cloud');

    const conflict = {
      filePath: 'track1.wav',
      localModified: new Date().toISOString(),
      remoteModified: new Date(Date.now() + 1000).toISOString(),
    };

    await sync.recordConflict(syncId.id, conflict);
    await sync.resolveConflict(syncId.id, 'track1.wav', 'use-remote');

    const conflicts = await sync.getConflicts(syncId.id);
    const resolved = conflicts.find((c) => c.filePath === 'track1.wav');
    expect(resolved?.resolution).toBe('use-remote');
  });

  it('enables selective sync', async () => {
    const projectId = 'test-project-10';
    const syncId = await sync.initializeSync(projectId, 'cloud');

    await sync.setSyncRules(syncId.id, {
      includeAudio: true,
      includeMetadata: true,
      excludePatterns: ['*.tmp', '.git/*'],
    });

    const status = await sync.getSyncStatus(projectId);
    expect(status?.syncRules).toBeDefined();
    expect(status?.syncRules?.includeAudio).toBe(true);
  });

  it('returns undefined for non-existent sync', async () => {
    const status = await sync.getSyncStatus('non-existent-project');
    expect(status).toBeUndefined();
  });
});

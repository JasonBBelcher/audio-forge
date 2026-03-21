import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerProjectHandlers } from '../../../../src/main/ipc/projectHandlers.js';
import type { ProjectService } from '../../../../src/main/services/project.service.js';

describe('Project IPC Handlers', () => {
  let mockIpcMain: any;
  let mockProjectService: any;
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    registeredHandlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        registeredHandlers.set(channel, handler);
      }),
    };

    mockProjectService = {
      listProjects: vi.fn().mockResolvedValue([]),
      createProject: vi.fn().mockResolvedValue({ id: 'proj_test_1', name: 'Test' }),
      updateProject: vi.fn().mockResolvedValue({ id: 'proj_test_1', name: 'Updated' }),
      deleteProject: vi.fn().mockResolvedValue(undefined),
      saveState: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('registers projects:getAll handler', () => {
    registerProjectHandlers(mockIpcMain, mockProjectService);
    expect(registeredHandlers.has('projects:getAll')).toBe(true);
  });

  it('registers projects:create handler', () => {
    registerProjectHandlers(mockIpcMain, mockProjectService);
    expect(registeredHandlers.has('projects:create')).toBe(true);
  });

  it('registers projects:update handler', () => {
    registerProjectHandlers(mockIpcMain, mockProjectService);
    expect(registeredHandlers.has('projects:update')).toBe(true);
  });

  it('registers projects:delete handler', () => {
    registerProjectHandlers(mockIpcMain, mockProjectService);
    expect(registeredHandlers.has('projects:delete')).toBe(true);
  });

  it('registers projects:saveState handler', () => {
    registerProjectHandlers(mockIpcMain, mockProjectService);
    expect(registeredHandlers.has('projects:saveState')).toBe(true);
  });

  describe('projects:getAll handler', () => {
    it('calls projectService.listProjects', async () => {
      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:getAll')!;

      await handler();
      expect(mockProjectService.listProjects).toHaveBeenCalled();
    });

    it('returns projects from service', async () => {
      const mockProjects = [{ id: 'proj_1', name: 'Project 1' }];
      mockProjectService.listProjects.mockResolvedValue(mockProjects);

      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:getAll')!;

      const result = await handler();
      expect(result).toEqual(mockProjects);
    });
  });

  describe('projects:create handler', () => {
    it('calls projectService.createProject with data', async () => {
      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:create')!;

      const data = { name: 'New Project', bpm: 130 };
      await handler(null, data);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(data);
    });

    it('returns created project', async () => {
      const createdProject = { id: 'proj_new', name: 'New Project', bpm: 130 };
      mockProjectService.createProject.mockResolvedValue(createdProject);

      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:create')!;

      const result = await handler(null, { name: 'New Project', bpm: 130 });
      expect(result).toEqual(createdProject);
    });
  });

  describe('projects:update handler', () => {
    it('calls projectService.updateProject with id and updates', async () => {
      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:update')!;

      const updates = { name: 'Updated Name', bpm: 140 };
      await handler(null, 'proj_test_1', updates);
      expect(mockProjectService.updateProject).toHaveBeenCalledWith('proj_test_1', updates);
    });

    it('returns updated project', async () => {
      const updatedProject = { id: 'proj_test_1', name: 'Updated Name', bpm: 140 };
      mockProjectService.updateProject.mockResolvedValue(updatedProject);

      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:update')!;

      const result = await handler(null, 'proj_test_1', { name: 'Updated Name' });
      expect(result).toEqual(updatedProject);
    });
  });

  describe('projects:delete handler', () => {
    it('calls projectService.deleteProject with id', async () => {
      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:delete')!;

      await handler(null, 'proj_test_1');
      expect(mockProjectService.deleteProject).toHaveBeenCalledWith('proj_test_1');
    });
  });

  describe('projects:saveState handler', () => {
    it('calls projectService.saveState with id and state', async () => {
      registerProjectHandlers(mockIpcMain, mockProjectService);
      const handler = registeredHandlers.get('projects:saveState')!;

      const state = { tracks: [], selectedTrack: null };
      await handler(null, 'proj_test_1', state);
      expect(mockProjectService.saveState).toHaveBeenCalledWith('proj_test_1', state);
    });
  });
});

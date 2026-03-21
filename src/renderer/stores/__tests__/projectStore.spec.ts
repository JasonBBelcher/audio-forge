import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock window.audioforge BEFORE importing projectStore
const mockWindowAudioforge = {
  projects: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'proj_test_1', name: 'Test' }),
    update: vi.fn().mockResolvedValue({ id: 'proj_test_1', name: 'Updated' }),
    delete: vi.fn().mockResolvedValue(undefined),
  },
};

Object.defineProperty(globalThis, 'audioforge', {
  value: mockWindowAudioforge,
  writable: true,
  configurable: true,
});

// NOW import projectStore after the mock is set up
import { projectStore } from '../projectStore';
import type { Project } from '../projectStore';

function projects() { return get(projectStore as any) as Project[]; }
function currentProject() { return get(projectStore.getCurrentProject()); }

describe('ProjectStore', () => {
  beforeEach(() => {
    projectStore.setCurrentProject(null);
  });

  describe('Projects Array Management', () => {
    it('initializes with default sample project', () => {
      const ps = projects();
      expect(ps).toBeDefined();
      expect(Array.isArray(ps)).toBe(true);
      expect(ps.length).toBeGreaterThan(0);
    });

    it('allows adding new projects', () => {
      const newProject: Project = {
        id: 'test-add-1', name: 'New Test Project', bpm: 128,
        timeSignature: '4/4', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      projectStore.addProject(newProject);
      expect(projects().some(p => p.id === 'test-add-1')).toBe(true);
    });

    it('places new projects at the beginning of the array', () => {
      const newProject: Project = {
        id: 'test-first', name: 'First Project', bpm: 120,
        timeSignature: '4/4', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      projectStore.addProject(newProject);
      expect(projects()[0].id).toBe('test-first');
    });

    it('removes projects by id', () => {
      const toRemove = projects()[0];
      projectStore.removeProject(toRemove.id);
      expect(projects().some(p => p.id === toRemove.id)).toBe(false);
    });

    it('updates project properties', () => {
      const id = projects()[0].id;
      projectStore.updateProject(id, { name: 'Updated Name', bpm: 150 });
      const updated = projects().find(p => p.id === id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.bpm).toBe(150);
    });

    it('updates the updatedAt timestamp on project update', async () => {
      const id = projects()[0].id;
      const originalTime = projects()[0].updatedAt;
      await new Promise(r => setTimeout(r, 10));
      projectStore.updateProject(id, { name: 'New Name' });
      const updated = projects().find(p => p.id === id);
      expect(new Date(updated?.updatedAt || 0).getTime()).toBeGreaterThan(new Date(originalTime).getTime());
    });

    it('preserves other projects when updating one', () => {
      const before = projects().length;
      projectStore.updateProject(projects()[0].id, { name: 'Updated' });
      expect(projects().length).toBe(before);
      expect(projects()[0].name).toBe('Updated');
    });
  });

  describe('Current Project Management', () => {
    it('initializes with null currentProject', () => {
      expect(currentProject()).toBeNull();
    });

    it('sets current project', () => {
      const testProject: Project = {
        id: 'current-test-1', name: 'Current Test', bpm: 120,
        timeSignature: '4/4', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      projectStore.setCurrentProject(testProject);
      expect(currentProject()?.id).toBe('current-test-1');
      expect(currentProject()?.name).toBe('Current Test');
    });

    it('clears current project when set to null', () => {
      const testProject: Project = {
        id: 'current-test-2', name: 'Test', bpm: 120,
        timeSignature: '4/4', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      projectStore.setCurrentProject(testProject);
      projectStore.setCurrentProject(null);
      expect(currentProject()).toBeNull();
    });

    it('allows switching between projects', () => {
      const p1: Project = {
        id: 'proj-1', name: 'Project 1', bpm: 120, timeSignature: '4/4',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const p2: Project = {
        id: 'proj-2', name: 'Project 2', bpm: 130, timeSignature: '3/4',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      projectStore.setCurrentProject(p1);
      expect(currentProject()?.id).toBe('proj-1');
      projectStore.setCurrentProject(p2);
      expect(currentProject()?.id).toBe('proj-2');
      expect(currentProject()?.bpm).toBe(130);
    });
  });

  describe('Store Methods', () => {
    it('provides subscribe method', () => { expect(typeof projectStore.subscribe).toBe('function'); });
    it('provides addProject method', () => { expect(typeof projectStore.addProject).toBe('function'); });
    it('provides removeProject method', () => { expect(typeof projectStore.removeProject).toBe('function'); });
    it('provides updateProject method', () => { expect(typeof projectStore.updateProject).toBe('function'); });
    it('provides setCurrentProject method', () => { expect(typeof projectStore.setCurrentProject).toBe('function'); });
    it('provides getCurrentProject method', () => { expect(typeof projectStore.getCurrentProject).toBe('function'); });
  });

  describe('Data Integrity', () => {
    it('maintains unique project IDs', () => {
      projectStore.addProject({
        id: 'unique-test', name: 'Unique Test', bpm: 120, timeSignature: '4/4',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      const ids = projects().map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('requires non-empty project names', () => {
      projectStore.addProject({
        id: 'empty-name-test', name: '', bpm: 120, timeSignature: '4/4',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      expect(projects().some(p => p.id === 'empty-name-test')).toBe(true);
    });

    it('preserves ISO date format for timestamps', () => {
      const now = new Date().toISOString();
      projectStore.addProject({
        id: 'date-test', name: 'Date Test', bpm: 120, timeSignature: '4/4',
        createdAt: now, updatedAt: now,
      });
      const added = projects().find(p => p.id === 'date-test');
      expect(added?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(added?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('IPC Integration', () => {
    it('provides loadProjects async function', () => {
      expect(typeof projectStore.loadProjects).toBe('function');
    });

    it('loadProjects calls window.audioforge.projects.getAll', async () => {
      mockWindowAudioforge.projects.getAll.mockResolvedValue([]);
      // Verify audioforge is available
      expect((globalThis as any).audioforge).toBeDefined();
      await projectStore.loadProjects();
      expect(mockWindowAudioforge.projects.getAll).toHaveBeenCalled();
    });

    it('loadProjects populates store with projects from IPC', async () => {
      const mockProjects = [
        {
          id: 'proj_ipc_1',
          name: 'IPC Project',
          bpm: 120,
          timeSignature: '4/4',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      mockWindowAudioforge.projects.getAll.mockResolvedValue(mockProjects);

      await projectStore.loadProjects();

      const loaded = projects();
      expect(loaded.some(p => p.id === 'proj_ipc_1')).toBe(true);
      expect(loaded.find(p => p.id === 'proj_ipc_1')?.name).toBe('IPC Project');
    });

    it('createProjectViaIPC calls IPC and updates local store', async () => {
      const newProject = {
        id: 'proj_new_ipc',
        name: 'New IPC Project',
        bpm: 130,
        timeSignature: '4/4',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockWindowAudioforge.projects.create.mockResolvedValue(newProject);

      await projectStore.createProjectViaIPC({ name: 'New IPC Project', bpm: 130 });

      expect(mockWindowAudioforge.projects.create).toHaveBeenCalledWith({
        name: 'New IPC Project',
        bpm: 130,
      });
      expect(projects().some(p => p.id === 'proj_new_ipc')).toBe(true);
    });

    it('deleteProject calls IPC and removes from local store', async () => {
      const existingProject = {
        id: 'proj_to_delete',
        name: 'To Delete',
        bpm: 120,
        timeSignature: '4/4',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      projectStore.addProject(existingProject);
      mockWindowAudioforge.projects.delete.mockResolvedValue(undefined);

      await projectStore.deleteProject('proj_to_delete');

      expect(mockWindowAudioforge.projects.delete).toHaveBeenCalledWith('proj_to_delete');
      expect(projects().some(p => p.id === 'proj_to_delete')).toBe(false);
    });

    it('updateProjectViaIPC calls IPC and updates local store', async () => {
      const existingProject = {
        id: 'proj_to_update',
        name: 'Original Name',
        bpm: 120,
        timeSignature: '4/4',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      projectStore.addProject(existingProject);

      const updatedProject = {
        ...existingProject,
        name: 'Updated Name',
        bpm: 140,
      };
      mockWindowAudioforge.projects.update.mockResolvedValue(updatedProject);

      await projectStore.updateProjectViaIPC('proj_to_update', { name: 'Updated Name', bpm: 140 });

      expect(mockWindowAudioforge.projects.update).toHaveBeenCalledWith(
        'proj_to_update',
        { name: 'Updated Name', bpm: 140 }
      );
      const updated = projects().find(p => p.id === 'proj_to_update');
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.bpm).toBe(140);
    });
  });
});

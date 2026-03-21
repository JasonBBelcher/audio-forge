import { writable } from 'svelte/store';

export interface Project {
  id: string;
  name: string;
  description?: string;
  bpm: number;
  timeSignature: string;
  key?: string;
  createdAt: string;
  updatedAt: string;
}

// Normalized from backend schema (snake_case to camelCase)
interface BackendProject {
  id: string;
  name: string;
  description?: string;
  bpm: number;
  timeSignature: string;
  key?: string;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'audioforge_projects';

function loadFromStorage(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Project[];
  } catch {
    // ignore parse errors
  }
  // Default sample project on first run
  return [
    {
      id: 'sample-1',
      name: 'Sample Project',
      bpm: 120,
      timeSignature: '4/4',
      key: 'C major',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function saveToStorage(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore storage errors
  }
}

function normalizeProject(backend: BackendProject): Project {
  return {
    id: backend.id,
    name: backend.name,
    description: backend.description,
    bpm: backend.bpm || 120,
    timeSignature: backend.timeSignature || '4/4',
    key: backend.key,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
  };
}

function createProjectStore() {
  const { subscribe, set, update } = writable<Project[]>(loadFromStorage());

  // Persist every change to localStorage as fallback
  subscribe((projects) => saveToStorage(projects));

  const currentProject = writable<Project | null>(null);

  // Helper function to check if IPC is available at runtime
  const checkHasIPC = () => typeof globalThis !== 'undefined' && (globalThis as any).audioforge;

  // Synchronous store methods (for backward compatibility)
  const addProjectToStore = (project: Project) => {
    update((projects) => [project, ...projects]);
  };

  const removeProjectFromStore = (id: string) => {
    update((projects) => projects.filter((p) => p.id !== id));
    currentProject.update((p) => (p?.id === id ? null : p));
  };

  const updateProjectInStore = (id: string, updates: Partial<Project>) => {
    update((projects) =>
      projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
    );
    // Keep currentProject in sync
    currentProject.update((p) =>
      p?.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
  };

  const storeApi = {
    subscribe,
    addProject: addProjectToStore,
    removeProject: removeProjectFromStore,
    updateProject: updateProjectInStore,
    setCurrentProject: (project: Project | null) => {
      currentProject.set(project);
    },
    getCurrentProject: () => currentProject,

    // IPC-based async methods
    async loadProjects() {
      const hasIPC = checkHasIPC();
      if (!hasIPC) return;
      try {
        const result = await (globalThis as any).audioforge.projects.getAll();
        const normalized = (result as BackendProject[]).map(normalizeProject);
        set(normalized);
      } catch (err) {
        console.error('Failed to load projects from IPC:', err);
      }
    },

    async createProjectViaIPC(data: { name: string; description?: string; bpm?: number; timeSignature?: string }) {
      const hasIPC = checkHasIPC();
      if (!hasIPC) {
        const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const project: Project = {
          id,
          name: data.name,
          description: data.description,
          bpm: data.bpm || 120,
          timeSignature: data.timeSignature || '4/4',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addProjectToStore(project);
        return project;
      }

      try {
        const result = await (globalThis as any).audioforge.projects.create(data);
        const normalized = normalizeProject(result);
        addProjectToStore(normalized);
        return normalized;
      } catch (err) {
        console.error('Failed to create project via IPC:', err);
        throw err;
      }
    },

    async updateProjectViaIPC(id: string, updates: Partial<Project>) {
      // Call IPC first if available
      const hasIPC = checkHasIPC();
      if (hasIPC) {
        try {
          const result = await (globalThis as any).audioforge.projects.update(id, updates);
          const normalized = normalizeProject(result);
          update((projects) =>
            projects.map((p) => (p.id === id ? normalized : p))
          );
          currentProject.update((p) => (p?.id === id ? normalized : p));
          return normalized;
        } catch (err) {
          console.error('Failed to update project via IPC:', err);
          throw err;
        }
      }

      // Fallback to local store (synchronous update like the old method)
      let result: Project | undefined;
      update((projects) => {
        return projects.map((p) => {
          if (p.id === id) {
            result = { ...p, ...updates, updatedAt: new Date().toISOString() };
            return result;
          }
          return p;
        });
      });
      if (result) {
        currentProject.update((p) => (p?.id === id ? result! : p));
      }
      return result;
    },

    async deleteProject(id: string) {
      const hasIPC = checkHasIPC();
      if (hasIPC) {
        try {
          await (globalThis as any).audioforge.projects.delete(id);
        } catch (err) {
          console.error('Failed to delete project via IPC:', err);
          throw err;
        }
      }

      removeProjectFromStore(id);
    },
  };

  return storeApi;
}

export const projectStore = createProjectStore();

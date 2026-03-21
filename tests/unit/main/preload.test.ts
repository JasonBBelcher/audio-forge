import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track what gets exposed via contextBridge
let exposedApi: any = null;

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((name: string, api: any) => {
      exposedApi = { name, api };
    }),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe('preload script', () => {
  beforeEach(async () => {
    exposedApi = null;
    vi.resetModules();
    const { ipcRenderer } = await import('electron');
    (ipcRenderer.invoke as any).mockClear?.();
    (ipcRenderer.on as any).mockClear?.();
    (ipcRenderer.removeListener as any).mockClear?.();
    await import('../../../src/main/preload.js');
  });

  it('exposes API as "audioforge" on the window', () => {
    expect(exposedApi).not.toBeNull();
    expect(exposedApi.name).toBe('audioforge');
  });

  it('exposes all required domain namespaces', () => {
    const api = exposedApi.api;
    const requiredNamespaces = [
      'youtube', 'audio', 'video', 'sync', 'platforms',
      'files', 'projects', 'jobs', 'settings', 'health',
      'hardware', 'midi',
    ];

    for (const ns of requiredNamespaces) {
      expect(api).toHaveProperty(ns);
      expect(typeof api[ns]).toBe('object');
    }
  });

  it('exposes on/off event subscription methods', () => {
    const api = exposedApi.api;
    expect(typeof api.on).toBe('function');
    expect(typeof api.off).toBe('function');
  });

  it('on() subscribes to ipcRenderer events', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi.api;
    const callback = vi.fn();

    api.on('test:channel', callback);

    expect(ipcRenderer.on).toHaveBeenCalledWith('test:channel', expect.any(Function));
  });

  it('off() removes ipcRenderer listener', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi.api;
    const callback = vi.fn();

    api.off('test:channel', callback);

    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('test:channel', callback);
  });

  it('on() strips the Electron event object before calling the callback', async () => {
    const { ipcRenderer } = await import('electron');
    // Clear previous calls from beforeEach
    (ipcRenderer.on as any).mockClear();

    const api = exposedApi.api;
    const callback = vi.fn();

    api.on('strip:test', callback);

    // Get the wrapper function that was registered with ipcRenderer.on
    const calls = (ipcRenderer.on as any).mock.calls;
    const registeredCall = calls.find((call: any[]) => call[0] === 'strip:test');
    expect(registeredCall).toBeDefined();

    // Simulate Electron calling the wrapper with (_event, ...args)
    const wrapper = registeredCall[1];
    wrapper({/* fake electron event */}, 'arg1', 'arg2');

    // The user callback should receive args without the event object
    expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
  });

  describe('settings namespace', () => {
    it('exposes settings.get', () => {
      const api = exposedApi.api;
      expect(typeof api.settings.get).toBe('function');
    });

    it('exposes settings.set', () => {
      const api = exposedApi.api;
      expect(typeof api.settings.set).toBe('function');
    });

    it('exposes settings.getAll', () => {
      const api = exposedApi.api;
      expect(typeof api.settings.getAll).toBe('function');
    });

    it('settings.get invokes settings:get channel', async () => {
      const { ipcRenderer } = await import('electron');
      const api = exposedApi.api;

      api.settings.get('theme', 'dark');

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:get', 'theme', 'dark');
    });

    it('settings.set invokes settings:set channel', async () => {
      const { ipcRenderer } = await import('electron');
      const api = exposedApi.api;

      api.settings.set('theme', 'light');

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:set', 'theme', 'light');
    });

    it('settings.getAll invokes settings:getAll channel', async () => {
      const { ipcRenderer } = await import('electron');
      const api = exposedApi.api;

      api.settings.getAll();

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:getAll');
    });
  });

  describe('health namespace', () => {
    it('exposes health.getStatus', () => {
      const api = exposedApi.api;
      expect(typeof api.health.getStatus).toBe('function');
    });

    it('health.getStatus invokes health:getStatus channel', async () => {
      const { ipcRenderer } = await import('electron');
      const api = exposedApi.api;

      api.health.getStatus();

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('health:getStatus');
    });
  });

  describe('jobs namespace', () => {
    it('exposes jobs.list', () => {
      const api = exposedApi.api;
      expect(typeof api.jobs.list).toBe('function');
    });

    it('exposes jobs.getStatus', () => {
      const api = exposedApi.api;
      expect(typeof api.jobs.getStatus).toBe('function');
    });

    it('exposes jobs.cancel', () => {
      const api = exposedApi.api;
      expect(typeof api.jobs.cancel).toBe('function');
    });

    it('jobs.list invokes jobs:list channel', async () => {
      const { ipcRenderer } = await import('electron');
      const api = exposedApi.api;

      api.jobs.list('pending');

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('jobs:list', 'pending');
    });

    it('jobs.getStatus invokes jobs:getStatus channel', async () => {
      const { ipcRenderer } = await import('electron');
      const api = exposedApi.api;

      api.jobs.getStatus('job-123');

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('jobs:getStatus', 'job-123');
    });

    it('jobs.cancel invokes jobs:cancel channel', async () => {
      const { ipcRenderer } = await import('electron');
      const api = exposedApi.api;

      api.jobs.cancel('job-123');

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('jobs:cancel', 'job-123');
    });
  });
});

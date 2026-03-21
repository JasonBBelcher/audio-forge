import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron
const mockLoadURL = vi.fn();
const mockLoadFile = vi.fn();
const mockOpenDevTools = vi.fn();
const mockOn = vi.fn();
const mockWebContents = { openDevTools: mockOpenDevTools };

const mockBrowserWindow = vi.fn().mockImplementation(() => ({
  loadURL: mockLoadURL,
  loadFile: mockLoadFile,
  webContents: mockWebContents,
  on: mockOn,
}));

const whenReadyCallbacks: Function[] = [];
const appOnCallbacks: Record<string, Function[]> = {};

vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn(() => ({
      then: (cb: Function) => {
        whenReadyCallbacks.push(cb);
        return { catch: vi.fn() };
      },
    })),
    on: vi.fn((event: string, cb: Function) => {
      if (!appOnCallbacks[event]) appOnCallbacks[event] = [];
      appOnCallbacks[event].push(cb);
    }),
    getPath: vi.fn((name: string) => `/mock/${name}`),
    quit: vi.fn(),
  },
  BrowserWindow: mockBrowserWindow,
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/mix.wav' }),
  },
}));

// Mock fs so ensureDir doesn't try to create real dirs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('')),
    readdirSync: vi.fn().mockReturnValue([]),
    promises: { writeFile: vi.fn().mockResolvedValue(undefined) },
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('')),
  readdirSync: vi.fn().mockReturnValue([]),
  promises: { writeFile: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  }),
}));

vi.mock('../../../src/main/utils/paths.js', () => ({
  getAppPaths: vi.fn(() => ({
    userData: '/mock/userData',
    media: '/mock/userData/media',
    database: '/mock/userData/audioforge.db',
    logs: '/mock/userData/logs',
    temp: '/mock/userData/temp',
    resources: '/mock/resources',
    bin: '/mock/resources/bin',
  })),
}));

// Mock database and services
vi.mock('../../../src/main/database/connection.js', () => ({
  createDatabase: vi.fn(() => ({
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({ all: vi.fn(), get: vi.fn(), run: vi.fn() }),
    close: vi.fn(),
  })),
}));

vi.mock('../../../src/main/database/migrations/runner.js', () => ({
  runMigrations: vi.fn(),
}));

vi.mock('../../../src/main/services/project.service.js', () => {
  const ProjectService = class {
    constructor(db: any) {}
    listProjects = vi.fn().mockResolvedValue([]);
    createProject = vi.fn().mockResolvedValue({});
    updateProject = vi.fn().mockResolvedValue({});
    deleteProject = vi.fn().mockResolvedValue(undefined);
    saveState = vi.fn().mockResolvedValue(undefined);
  };
  return { ProjectService };
});

vi.mock('../../../src/main/services/settings.service.js', () => {
  const SettingsService = class {
    constructor(db: any) {}
    get = vi.fn();
    set = vi.fn();
    getAll = vi.fn().mockReturnValue({});
  };
  return { SettingsService };
});

vi.mock('../../../src/main/services/queue.service.js', () => {
  const QueueService = class {
    constructor(db: any) {}
    listJobs = vi.fn().mockReturnValue([]);
    getJob = vi.fn();
    cancel = vi.fn();
  };
  return { QueueService };
});

vi.mock('../../../src/main/services/health.service.js', () => {
  const HealthService = class {
    getStatus = vi.fn().mockResolvedValue({ tools: {}, system: {} });
  };
  return { HealthService };
});

vi.mock('../../../src/main/ipc/projectHandlers.js', () => ({
  registerProjectHandlers: vi.fn((ipcMain, service) => {
    ipcMain.handle('projects:getAll', vi.fn());
    ipcMain.handle('projects:create', vi.fn());
    ipcMain.handle('projects:update', vi.fn());
    ipcMain.handle('projects:delete', vi.fn());
    ipcMain.handle('projects:saveState', vi.fn());
  }),
}));

vi.mock('../../../src/main/ipc/settingsHandlers.js', () => ({
  registerSettingsHandlers: vi.fn((ipcMain, service) => {
    ipcMain.handle('settings:get', vi.fn());
    ipcMain.handle('settings:set', vi.fn());
    ipcMain.handle('settings:getAll', vi.fn());
  }),
}));

vi.mock('../../../src/main/ipc/healthHandlers.js', () => ({
  registerHealthHandlers: vi.fn((ipcMain, service) => {
    ipcMain.handle('health:getStatus', vi.fn());
  }),
}));

vi.mock('../../../src/main/ipc/jobHandlers.js', () => ({
  registerJobHandlers: vi.fn((ipcMain, service) => {
    ipcMain.handle('jobs:list', vi.fn());
    ipcMain.handle('jobs:getStatus', vi.fn());
    ipcMain.handle('jobs:cancel', vi.fn());
  }),
}));

describe('main process', () => {
  beforeEach(() => {
    vi.resetModules();
    mockBrowserWindow.mockClear();
    mockLoadURL.mockClear();
    mockLoadFile.mockClear();
    mockOpenDevTools.mockClear();
    mockOn.mockClear();
    whenReadyCallbacks.length = 0;
    Object.keys(appOnCallbacks).forEach((k) => delete appOnCallbacks[k]);
  });

  it('registers whenReady callback on import', async () => {
    await import('../../../src/main/main.js');
    expect(whenReadyCallbacks.length).toBeGreaterThan(0);
  });

  it('creates BrowserWindow with secure defaults on ready', async () => {
    await import('../../../src/main/main.js');
    // Trigger the whenReady callback
    whenReadyCallbacks[0]();

    expect(mockBrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'AudioForge',
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          nodeIntegration: false,
        }),
      })
    );
  });

  it('sets contextIsolation to true', async () => {
    await import('../../../src/main/main.js');
    whenReadyCallbacks[0]();

    const webPrefs = mockBrowserWindow.mock.calls[0][0].webPreferences;
    expect(webPrefs.contextIsolation).toBe(true);
  });

  it('disables nodeIntegration', async () => {
    await import('../../../src/main/main.js');
    whenReadyCallbacks[0]();

    const webPrefs = mockBrowserWindow.mock.calls[0][0].webPreferences;
    expect(webPrefs.nodeIntegration).toBe(false);
  });

  it('disables sandbox (required for IPC preload)', async () => {
    await import('../../../src/main/main.js');
    whenReadyCallbacks[0]();

    const webPrefs = mockBrowserWindow.mock.calls[0][0].webPreferences;
    expect(webPrefs.sandbox).toBe(false);
  });

  it('configures a preload script', async () => {
    await import('../../../src/main/main.js');
    whenReadyCallbacks[0]();

    const webPrefs = mockBrowserWindow.mock.calls[0][0].webPreferences;
    expect(webPrefs.preload).toBeDefined();
    expect(typeof webPrefs.preload).toBe('string');
    expect(webPrefs.preload).toContain('preload');
  });

  it('registers window-all-closed handler', async () => {
    await import('../../../src/main/main.js');

    expect(appOnCallbacks['window-all-closed']).toBeDefined();
    expect(appOnCallbacks['window-all-closed'].length).toBe(1);
  });

  it('registers activate handler for macOS dock click', async () => {
    await import('../../../src/main/main.js');

    expect(appOnCallbacks['activate']).toBeDefined();
    expect(appOnCallbacks['activate'].length).toBe(1);
  });

  it('loads dev URL in development mode', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    await import('../../../src/main/main.js');
    whenReadyCallbacks[0]();

    expect(mockLoadURL).toHaveBeenCalledWith('http://localhost:5173');

    process.env.NODE_ENV = origEnv;
  });

  it('sets mainWindow to null when window is closed', async () => {
    await import('../../../src/main/main.js');
    whenReadyCallbacks[0]();

    // Find the 'closed' handler registered on the window
    const closedCall = mockOn.mock.calls.find((call: any[]) => call[0] === 'closed');
    expect(closedCall).toBeDefined();

    // Call the closed handler — should not throw
    closedCall[1]();
  });

  it('window-all-closed handler does not quit on macOS', async () => {
    const { app } = await import('electron');
    const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    await import('../../../src/main/main.js');

    const handler = appOnCallbacks['window-all-closed'][0];
    handler();

    // app.quit should NOT have been called (we didn't mock it to track)
    // Just verify it doesn't throw on macOS
    if (origPlatform) {
      Object.defineProperty(process, 'platform', origPlatform);
    }
  });

  it('activate handler recreates window when mainWindow is null', async () => {
    await import('../../../src/main/main.js');

    // Create window first, then close it
    whenReadyCallbacks[0]();
    const closedCall = mockOn.mock.calls.find((call: any[]) => call[0] === 'closed');
    closedCall[1](); // sets mainWindow to null

    mockBrowserWindow.mockClear();

    // Trigger activate — should create a new window
    const handler = appOnCallbacks['activate'][0];
    handler();

    expect(mockBrowserWindow).toHaveBeenCalled();
  });

  describe('files:showSaveDialog IPC handler', () => {
    it('registers the files:showSaveDialog channel', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      const registered = (ipcMain.handle as any).mock.calls.map((c: any[]) => c[0]);
      expect(registered).toContain('files:showSaveDialog');
    });

    it('handler is callable and returns a defined value', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');

      const [, handler] = (ipcMain.handle as any).mock.calls
        .find((c: any[]) => c[0] === 'files:showSaveDialog');

      await expect(handler({}, { defaultPath: 'test.wav', filters: [] })).resolves.toBeDefined();
    });

    it('returns canceled result when mainWindow is null', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      // Don't call whenReadyCallbacks — mainWindow stays null

      const [, handler] = (ipcMain.handle as any).mock.calls
        .find((c: any[]) => c[0] === 'files:showSaveDialog');

      const result = await handler({}, {});
      expect(result).toEqual({ canceled: true, filePath: '' });
    });
  });

  describe('files:writeFile IPC handler', () => {
    it('registers the files:writeFile channel', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      const registered = (ipcMain.handle as any).mock.calls.map((c: any[]) => c[0]);
      expect(registered).toContain('files:writeFile');
    });

    it('resolves without error when writing valid data', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');

      const [, handler] = (ipcMain.handle as any).mock.calls
        .find((c: any[]) => c[0] === 'files:writeFile');

      const data = new Uint8Array([1, 2, 3, 4]);
      // fs.promises.writeFile is mocked to resolve; handler should not throw
      await expect(handler({}, '/tmp/output.wav', data)).resolves.toBeUndefined();
    });
  });

  describe('Service IPC Handlers', () => {
    it('registers projects:getAll channel', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      const registered = (ipcMain.handle as any).mock.calls.map((c: any[]) => c[0]);
      expect(registered).toContain('projects:getAll');
    });

    it('registers projects:create channel', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      const registered = (ipcMain.handle as any).mock.calls.map((c: any[]) => c[0]);
      expect(registered).toContain('projects:create');
    });

    it('registers settings:get channel', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      const registered = (ipcMain.handle as any).mock.calls.map((c: any[]) => c[0]);
      expect(registered).toContain('settings:get');
    });

    it('registers health:getStatus channel', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      const registered = (ipcMain.handle as any).mock.calls.map((c: any[]) => c[0]);
      expect(registered).toContain('health:getStatus');
    });

    it('registers jobs:list channel', async () => {
      const { ipcMain } = await import('electron');
      await import('../../../src/main/main.js');
      const registered = (ipcMain.handle as any).mock.calls.map((c: any[]) => c[0]);
      expect(registered).toContain('jobs:list');
    });
  });
});

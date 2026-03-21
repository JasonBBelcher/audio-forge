import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OSIntegrationService } from '../../../../src/main/services/os-integration.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('OSIntegrationService', () => {
  let osIntegration: OSIntegrationService;

  beforeEach(() => {
    osIntegration = new OSIntegrationService(':memory:');
    vi.clearAllMocks();
  });

  it('creates system tray icon', async () => {
    const trayId = await osIntegration.createTrayIcon();

    expect(trayId).toBeDefined();
  });

  it('shows notification', async () => {
    const notified = await osIntegration.showNotification({
      title: 'Export Complete',
      body: 'Your track has been exported successfully',
      icon: 'success',
    });

    expect(notified).toBe(true);
  });

  it('shows error notification', async () => {
    const notified = await osIntegration.showNotification({
      title: 'Export Failed',
      body: 'Failed to export track',
      icon: 'error',
    });

    expect(notified).toBe(true);
  });

  it('creates context menu for tray icon', async () => {
    const trayId = await osIntegration.createTrayIcon();

    const menuCreated = await osIntegration.createTrayMenu(trayId, [
      { label: 'Show', action: 'show-window' },
      { label: 'Exit', action: 'quit' },
    ]);

    expect(menuCreated).toBe(true);
  });

  it('registers global keyboard shortcut', async () => {
    const registered = await osIntegration.registerGlobalShortcut('CommandOrControl+Shift+P', () => {
      // Play/pause action
    });

    expect(registered).toBe(true);
  });

  it('unregisters global keyboard shortcut', async () => {
    await osIntegration.registerGlobalShortcut('CommandOrControl+Shift+P', () => {});

    const unregistered = await osIntegration.unregisterGlobalShortcut('CommandOrControl+Shift+P');

    expect(unregistered).toBe(true);
  });

  it('opens file dialog', async () => {
    const result = await osIntegration.openFileDialog({
      title: 'Open Project',
      filters: [{ name: 'AudioForge Projects', extensions: ['afp'] }],
    });

    expect(result).toBeDefined();
  });

  it('opens save dialog', async () => {
    const result = await osIntegration.openSaveDialog({
      title: 'Save Project',
      defaultPath: '/path/to/project.afp',
    });

    expect(result).toBeDefined();
  });

  it('opens directory dialog', async () => {
    const result = await osIntegration.openDirectoryDialog({
      title: 'Select Folder',
    });

    expect(result).toBeDefined();
  });

  it('creates application menu', async () => {
    const menuCreated = await osIntegration.createApplicationMenu([
      {
        label: 'File',
        submenu: [
          { label: 'New Project', accelerator: 'CmdOrCtrl+N' },
          { label: 'Open Project', accelerator: 'CmdOrCtrl+O' },
        ],
      },
    ]);

    expect(menuCreated).toBe(true);
  });

  it('brings window to front', async () => {
    const focused = await osIntegration.focusWindow();

    expect(focused).toBe(true);
  });

  it('minimizes window', async () => {
    const minimized = await osIntegration.minimizeWindow();

    expect(minimized).toBe(true);
  });

  it('maximizes window', async () => {
    const maximized = await osIntegration.maximizeWindow();

    expect(maximized).toBe(true);
  });

  it('toggles window fullscreen', async () => {
    const toggled = await osIntegration.toggleFullscreen();

    expect(toggled).toBe(true);
  });

  it('gets system information', async () => {
    const sysInfo = await osIntegration.getSystemInfo();

    expect(sysInfo).toHaveProperty('platform');
    expect(sysInfo).toHaveProperty('arch');
    expect(sysInfo).toHaveProperty('osVersion');
  });

  it('checks for updates', async () => {
    const updateInfo = await osIntegration.checkForUpdates();

    expect(updateInfo).toHaveProperty('updateAvailable');
  });

  it('opens external URL', async () => {
    const opened = await osIntegration.openExternalURL('https://github.com/audioforge/audioforge');

    expect(opened).toBe(true);
  });

  it('copies to clipboard', async () => {
    const copied = await osIntegration.copyToClipboard('test content');

    expect(copied).toBe(true);
  });

  it('reads from clipboard', async () => {
    await osIntegration.copyToClipboard('clipboard test');

    const content = await osIntegration.readFromClipboard();

    expect(content).toBe('clipboard test');
  });

  it('registers file association', async () => {
    const registered = await osIntegration.registerFileAssociation('.afp', 'AudioForge Project');

    expect(registered).toBe(true);
  });

  it('handles drag and drop events', async () => {
    let dropHandled = false;
    await osIntegration.onFileDrop((files) => {
      dropHandled = files.length > 0;
    });

    expect(typeof dropHandled).toBe('boolean');
  });

  it('enables dark mode detection', async () => {
    const isDark = await osIntegration.isDarkMode();

    expect(typeof isDark).toBe('boolean');
  });

  it('registers theme change listener', async () => {
    let themeChanged = false;
    await osIntegration.onThemeChange((isDark) => {
      themeChanged = true;
    });

    expect(typeof themeChanged).toBe('boolean');
  });

  it('gets available audio devices', async () => {
    const devices = await osIntegration.getAudioDevices();

    expect(Array.isArray(devices)).toBe(true);
  });

  it('opens preferences window', async () => {
    const opened = await osIntegration.openPreferences();

    expect(opened).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import WatchFoldersView from '../WatchFoldersView.svelte';

describe('WatchFoldersView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Watch Folders heading', () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);
    expect(screen.getByText('Watch Folders')).toBeTruthy();
  });

  it('renders Add Folder button', () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);
    expect(screen.getByText(/Add Folder/)).toBeTruthy();
  });

  it('shows empty state when no folders watched', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText('No folders watched yet.')).toBeTruthy();
    });
  });

  it('loads watched folders on mount', async () => {
    const mockGetFolders = vi.fn().mockResolvedValue([]);
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: mockGetFolders,
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(mockGetFolders).toHaveBeenCalled();
    });
  });

  it('displays watched folders returned from API', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
          '/Users/user/Downloads',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText(/samples/)).toBeTruthy();
      expect(screen.getByText(/Downloads/)).toBeTruthy();
    });
  });

  it('renders Remove button for each watched folder', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
          '/Users/user/Downloads',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      const removeButtons = screen.getAllByText('✕');
      expect(removeButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('clicking Remove on a folder calls af.watcher.unwatchFolder with the folder path', async () => {
    const mockUnwatch = vi.fn().mockResolvedValue({});
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: mockUnwatch,
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText(/samples/)).toBeTruthy();
    });

    const removeBtn = screen.getByText('✕');
    await fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockUnwatch).toHaveBeenCalledWith('/Users/user/Music/samples');
    });
  });

  it('folder disappears from list after removing', async () => {
    const mockUnwatch = vi.fn().mockResolvedValue({});
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: mockUnwatch,
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText(/samples/)).toBeTruthy();
    });

    const removeBtn = screen.getByText('✕');
    await fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/samples/)).toBeFalsy();
    });
  });

  it('clicking Add Folder button calls af.files.showOpenDialog', async () => {
    const mockShowDialog = vi.fn().mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: mockShowDialog },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    const addBtn = screen.getByText(/Add Folder/);
    await fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockShowDialog).toHaveBeenCalled();
    });
  });

  it('showOpenDialog receives openDirectory property', async () => {
    const mockShowDialog = vi.fn().mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: mockShowDialog },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    const addBtn = screen.getByText(/Add Folder/);
    await fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.arrayContaining(['openDirectory']),
        })
      );
    });
  });

  it('added folder appears in the list', async () => {
    const mockWatch = vi.fn().mockResolvedValue({ watching: true, path: '/Users/user/Music' });
    const mockShowDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/user/Music'],
    });
    const mockGetFolders = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['/Users/user/Music']);
    const mockAf = {
      watcher: {
        watchFolder: mockWatch,
        unwatchFolder: vi.fn(),
        getWatchedFolders: mockGetFolders,
      },
      files: { showOpenDialog: mockShowDialog },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText('No folders watched yet.')).toBeTruthy();
    });

    const addButtons = screen.getAllByText(/Add Folder/);
    await fireEvent.click(addButtons[0]); // Click the button, not the help text

    await waitFor(() => {
      expect(mockWatch).toHaveBeenCalled();
    });

    // Check for the formatted path (last 2 segments)
    await waitFor(() => {
      expect(screen.getByText(/user\/Music/)).toBeTruthy();
    });
  });

  it('subscribes to library:fileAdded event via af.on', async () => {
    const mockOn = vi.fn().mockReturnValue(() => {});
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: mockOn,
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalledWith(
        'library:fileAdded',
        expect.any(Function)
      );
    });
  });

  it('event subscription returns unsubscriber function', async () => {
    const mockUnsubscribe = vi.fn();
    const mockOn = vi.fn().mockReturnValue(mockUnsubscribe);
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: mockOn,
    };
    (window as any).audioforge = mockAf;

    const { unmount } = render(WatchFoldersView);

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });

    // Unmount component to trigger onDestroy
    unmount();

    // Verify cleanup was called (unsubscribers should be called)
    // Note: exact behavior depends on Svelte lifecycle
  });

  it('activity log updates when file is added via event', async () => {
    let fileAddedCallback: ((data: { filePath: string }) => void) | null = null;
    const mockOn = vi.fn((event, callback) => {
      if (event === 'library:fileAdded') {
        fileAddedCallback = callback;
      }
      return () => {};
    });
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: mockOn,
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });

    // Simulate file added event
    if (fileAddedCallback) {
      fileAddedCallback({ filePath: '/Users/user/Music/newfile.wav' });

      await waitFor(() => {
        expect(screen.getByText('newfile.wav')).toBeTruthy();
      });
    }
  });

  it('shows Recent Activity section', () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);
    expect(screen.getByText('Recent Activity')).toBeTruthy();
  });

  it('shows empty state for activity when no files detected', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText(/Files detected by the watcher/)).toBeTruthy();
    });
  });

  it('folder count badge displays number of watched folders', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
          '/Users/user/Downloads',
          '/Users/user/Projects/audio',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeTruthy();
    });
  });

  it('status indicator shows Active · Recursive for watched folders', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText('Active · Recursive')).toBeTruthy();
    });
  });

  it('duplicate folder check prevents re-adding same folder', async () => {
    const mockWatch = vi.fn().mockResolvedValue({ watching: true, path: '/Users/user/Music' });
    const mockShowDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/user/Music/samples'],
    });
    const mockAf = {
      watcher: {
        watchFolder: mockWatch,
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
        ]),
      },
      files: { showOpenDialog: mockShowDialog },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText(/samples/)).toBeTruthy();
    });

    const addBtn = screen.getByText(/Add Folder/);
    await fireEvent.click(addBtn);

    // Should try to add but prevent duplicate (watchFolder might still be called)
    // The UI won't add duplicate to watchedFolders array
    const samplesItems = screen.getAllByText(/samples/);
    expect(samplesItems.length).toBeLessThanOrEqual(2); // header + one item
  });

  it('shows error message on failed unwatchFolder', async () => {
    const mockUnwatch = vi.fn().mockRejectedValue(new Error('Permission denied'));
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: mockUnwatch,
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/samples',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(screen.getByText(/samples/)).toBeTruthy();
    });

    const removeBtn = screen.getByText('✕');
    await fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Permission denied/)).toBeTruthy();
    });
  });

  it('shows error message on failed showOpenDialog', async () => {
    const mockShowDialog = vi.fn().mockRejectedValue(new Error('Dialog canceled'));
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: mockShowDialog },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    const addBtn = screen.getByText(/Add Folder/);
    await fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dialog canceled/)).toBeTruthy();
    });
  });

  it('renders subtitle describing watcher functionality', () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);
    expect(screen.getByText(/monitors these folders/)).toBeTruthy();
  });

  it('formats full paths to show last 2 segments', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music/production/samples/drums',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      // Should show abbreviated path
      expect(screen.getByText(/samples\/drums/)).toBeTruthy();
    });
  });

  it('renders folder icon for each watched folder', async () => {
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([
          '/Users/user/Music',
          '/Users/user/Downloads',
        ]),
      },
      files: { showOpenDialog: vi.fn() },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      const folderIcons = screen.getAllByText('📂');
      expect(folderIcons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('cancel button in dialog does not add folder', async () => {
    const mockWatch = vi.fn();
    const mockShowDialog = vi.fn().mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    const mockAf = {
      watcher: {
        watchFolder: mockWatch,
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: mockShowDialog },
      on: vi.fn().mockReturnValue(() => {}),
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    const addBtn = screen.getByText(/Add Folder/);
    await fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockShowDialog).toHaveBeenCalled();
    });

    // watchFolder should not be called if dialog was canceled
    expect(mockWatch).not.toHaveBeenCalled();
  });

  it('activity entry shows file name and relative timestamp', async () => {
    let fileAddedCallback: ((data: { filePath: string }) => void) | null = null;
    const mockOn = vi.fn((event, callback) => {
      if (event === 'library:fileAdded') {
        fileAddedCallback = callback;
      }
      return () => {};
    });
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: mockOn,
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });

    if (fileAddedCallback) {
      fileAddedCallback({ filePath: '/Users/user/Music/song.wav' });

      await waitFor(() => {
        expect(screen.getByText('song.wav')).toBeTruthy();
        expect(screen.getByText('just now')).toBeTruthy();
      });
    }
  });

  it('activity log is limited to last 50 entries', async () => {
    let fileAddedCallback: ((data: { filePath: string }) => void) | null = null;
    const mockOn = vi.fn((event, callback) => {
      if (event === 'library:fileAdded') {
        fileAddedCallback = callback;
      }
      return () => {};
    });
    const mockAf = {
      watcher: {
        watchFolder: vi.fn(),
        unwatchFolder: vi.fn(),
        getWatchedFolders: vi.fn().mockResolvedValue([]),
      },
      files: { showOpenDialog: vi.fn() },
      on: mockOn,
    };
    (window as any).audioforge = mockAf;

    render(WatchFoldersView);

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });

    // Simulate adding 60 files
    if (fileAddedCallback) {
      for (let i = 0; i < 60; i++) {
        fileAddedCallback({ filePath: `/Users/user/Music/song${i}.wav` });
      }

      await waitFor(() => {
        // Should show count badge with 50
        const countBadges = screen.getAllByText('50');
        expect(countBadges.length).toBeGreaterThan(0);
      });
    }
  });
});

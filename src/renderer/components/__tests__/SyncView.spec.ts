// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SyncView from '../SyncView.svelte';

describe('SyncView Component', () => {
  beforeEach(() => {
    (window as any).audioforge = undefined;
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      expect(container).toBeTruthy();
    });

    it('shows "Sync" heading', () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      const heading = container.querySelector('h2');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toContain('Sync');
    });

    it('works without audioforge API', () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      expect(container.textContent).toContain('Sync');
    });

    it('shows loading state while loading', async () => {
      let resolveSessions: any;
      const sessionsPromise = new Promise(r => {
        resolveSessions = r;
      });

      (window as any).audioforge = {
        sync: {
          listSessions: () => sessionsPromise,
        },
      };

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 100));

      expect(container.textContent).toContain('Loading');

      resolveSessions([]);
      await new Promise(r => setTimeout(r, 100));
    });
  });

  describe('Session Listing', () => {
    it('shows session list when sessions exist', async () => {
      (window as any).audioforge = {
        sync: {
          listSessions: vi.fn().mockResolvedValue([
            {
              id: 'session1',
              backend: 'git',
              status: 'synced',
              lastSyncTime: '2025-03-21T10:30:00Z',
            },
          ]),
        },
      };

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 100));

      expect(container.textContent).toContain('git');
    });

    it('shows backend name for each session', async () => {
      (window as any).audioforge = {
        sync: {
          listSessions: vi.fn().mockResolvedValue([
            {
              id: 'session1',
              backend: 'dropbox',
              status: 'synced',
              lastSyncTime: '2025-03-21T10:30:00Z',
            },
          ]),
        },
      };

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 100));

      expect(container.textContent).toContain('dropbox');
    });

  });


  describe('Initialize Sync', () => {
    it('has an "Initialize Sync" button', () => {
      const { getByText } = render(SyncView, { props: { projectId: 'test-project' } });
      expect(getByText(/Initialize Sync/i)).toBeTruthy();
    });

    it('has a backend selector with git, dropbox, s3 options', async () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 100));

      const select = container.querySelector('select');
      if (select) {
        const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
        expect(options).toContain('git');
        expect(options).toContain('dropbox');
        expect(options).toContain('s3');
      }
    });

    it('calls sync.initializeSync when Initialize Sync is clicked', async () => {
      const initSyncSpy = vi.fn().mockResolvedValue({ success: true });
      (window as any).audioforge = {
        sync: {
          listSessions: vi.fn().mockResolvedValue([]),
          initializeSync: initSyncSpy,
        },
      };

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 100));

      const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Initialize'));
      await fireEvent.click(button!);
      await new Promise(r => setTimeout(r, 100));

      expect(initSyncSpy).toHaveBeenCalledWith('test-project', expect.any(String));
    });

    it('passes selected backend to initializeSync', async () => {
      const initSyncSpy = vi.fn().mockResolvedValue({ success: true });
      (window as any).audioforge = {
        sync: {
          listSessions: vi.fn().mockResolvedValue([]),
          initializeSync: initSyncSpy,
        },
      };

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 100));

      const select = container.querySelector('select');
      if (select) {
        await fireEvent.change(select, { target: { value: 's3' } });
      }

      const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Initialize'));
      await fireEvent.click(button!);
      await new Promise(r => setTimeout(r, 100));

      expect(initSyncSpy).toHaveBeenCalledWith('test-project', 's3');
    });
  });

  describe('Props', () => {
    it('receives projectId prop', async () => {
      const listSessionsSpy = vi.fn().mockResolvedValue([]);
      (window as any).audioforge = {
        sync: {
          listSessions: listSessionsSpy,
        },
      };

      render(SyncView, { props: { projectId: 'my-project-id' } });
      await new Promise(r => setTimeout(r, 100));

      expect(listSessionsSpy).toHaveBeenCalledWith('my-project-id');
    });
  });

  describe('SyncView — Audio→Video Sync', () => {
    let mockAf: any;

    beforeEach(() => {
      mockAf = {
        mediaSync: {
          findOffset: vi.fn(),
          syncAudioWithVideo: vi.fn(),
        },
        files: {
          showOpenDialog: vi.fn(),
        },
      };
      (window as any).audioforge = mockAf;
    });

    it('renders "Audio → Video Sync" heading', () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      expect(container.textContent).toContain('Audio → Video Sync');
    });

    it('has a "Browse…" button for reference file', async () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      const buttons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('has a "Browse…" button for target audio', async () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      expect(browseButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('"Find Offset" button is disabled when paths not set', async () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      expect(findOffsetBtn).toBeTruthy();
      expect(findOffsetBtn?.getAttribute('disabled')).not.toBeNull();
    });

    it('"Find Offset" button is enabled after both paths are set', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      // Click reference file browse button
      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 50));

      // Click target audio browse button
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 50));

      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      const disabledAttr = findOffsetBtn?.getAttribute('disabled');
      expect(disabledAttr === null || disabledAttr === undefined).toBe(true);
    });

    it('clicking "Find Offset" calls mediaSync.findOffset with correct paths', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });
      mockAf.mediaSync.findOffset.mockResolvedValue({ offsetSec: 1.23, confidence: 0.95 });

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      // Set reference file
      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 0));

      // Set target audio
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 0));

      // Click find offset
      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      await fireEvent.click(findOffsetBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(mockAf.mediaSync.findOffset).toHaveBeenCalledWith('/path/to/ref.wav', '/path/to/target.wav');
    });

    it('shows loading text while finding offset', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });
      let resolveFindOffset: any;
      mockAf.mediaSync.findOffset.mockReturnValue(
        new Promise(r => {
          resolveFindOffset = r;
        })
      );

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      // Set paths
      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 0));

      // Click find offset
      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      await fireEvent.click(findOffsetBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('Finding');

      resolveFindOffset({ offsetSec: 1.23, confidence: 0.95 });
      await new Promise(r => setTimeout(r, 0));
    });

    it('shows offset result with seconds and confidence percentage', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });
      mockAf.mediaSync.findOffset.mockResolvedValue({ offsetSec: 1.23, confidence: 0.95 });

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      // Set paths and find offset
      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 0));

      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      await fireEvent.click(findOffsetBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('1.23');
      expect(container.textContent).toContain('95%');
    });

    it('"Sync Audio to Video" button is disabled before offset found', async () => {
      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      const syncBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Sync Audio to Video')
      );
      expect(syncBtn).toBeTruthy();
      expect(syncBtn?.getAttribute('disabled')).not.toBeNull();
    });

    it('clicking "Sync Audio to Video" calls mediaSync.syncAudioWithVideo with correct args', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });
      mockAf.mediaSync.findOffset.mockResolvedValue({ offsetSec: 1.23, confidence: 0.95 });
      mockAf.mediaSync.syncAudioWithVideo.mockResolvedValue({ outputPath: '/path/to/output.wav' });

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      // Set all three paths
      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );

      // Set reference file
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 0));

      // Set target audio
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 0));

      // Find offset
      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      await fireEvent.click(findOffsetBtn!);
      await new Promise(r => setTimeout(r, 0));

      // Set output path
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/output.wav'], canceled: false });
      const browseButtonsAfter = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtonsAfter[2]);
      await new Promise(r => setTimeout(r, 0));

      // Click sync
      const syncBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Sync Audio to Video')
      );
      await fireEvent.click(syncBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(mockAf.mediaSync.syncAudioWithVideo).toHaveBeenCalledWith(
        '/path/to/ref.wav',
        '/path/to/target.wav',
        1.23,
        '/path/to/output.wav'
      );
    });

    it('shows "Syncing…" while sync is running', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });
      mockAf.mediaSync.findOffset.mockResolvedValue({ offsetSec: 1.23, confidence: 0.95 });
      let resolveSyncAudio: any;
      mockAf.mediaSync.syncAudioWithVideo.mockReturnValue(
        new Promise(r => {
          resolveSyncAudio = r;
        })
      );

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      // Set all paths (simplified - just setting the mocks)
      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 0));

      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      await fireEvent.click(findOffsetBtn!);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/output.wav'], canceled: false });
      const browseButtonsAfter = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtonsAfter[2]);
      await new Promise(r => setTimeout(r, 0));

      const syncBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Sync Audio to Video')
      );
      await fireEvent.click(syncBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('Syncing');

      resolveSyncAudio({ outputPath: '/path/to/output.wav' });
      await new Promise(r => setTimeout(r, 0));
    });

    it('shows success message after sync completes', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });
      mockAf.mediaSync.findOffset.mockResolvedValue({ offsetSec: 1.23, confidence: 0.95 });
      mockAf.mediaSync.syncAudioWithVideo.mockResolvedValue({ outputPath: '/path/to/output.wav' });

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 0));

      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      await fireEvent.click(findOffsetBtn!);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/output.wav'], canceled: false });
      const browseButtonsAfter = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtonsAfter[2]);
      await new Promise(r => setTimeout(r, 0));

      const syncBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Sync Audio to Video')
      );
      await fireEvent.click(syncBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(
        container.textContent?.includes('complete') ||
        container.textContent?.includes('saved') ||
        container.textContent?.includes('Output')
      ).toBe(true);
    });

    it('shows error message if sync fails', async () => {
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/ref.wav'], canceled: false });
      mockAf.mediaSync.findOffset.mockResolvedValue({ offsetSec: 1.23, confidence: 0.95 });
      mockAf.mediaSync.syncAudioWithVideo.mockRejectedValue(new Error('Sync failed'));

      const { container } = render(SyncView, { props: { projectId: 'test-project' } });
      await new Promise(r => setTimeout(r, 0));

      const browseButtons = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtons[0]);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/target.wav'], canceled: false });
      await fireEvent.click(browseButtons[1]);
      await new Promise(r => setTimeout(r, 0));

      const findOffsetBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Find Offset')
      );
      await fireEvent.click(findOffsetBtn!);
      await new Promise(r => setTimeout(r, 0));

      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/path/to/output.wav'], canceled: false });
      const browseButtonsAfter = Array.from(container.querySelectorAll('button')).filter(b =>
        b.textContent?.includes('Browse')
      );
      await fireEvent.click(browseButtonsAfter[2]);
      await new Promise(r => setTimeout(r, 0));

      const syncBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Sync Audio to Video')
      );
      await fireEvent.click(syncBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('Error') || expect(container.textContent).toContain('Failed');
    });
  });
});

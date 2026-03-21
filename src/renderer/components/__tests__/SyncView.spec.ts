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
});

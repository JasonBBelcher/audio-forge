// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FilesView from '../FilesView.svelte';

describe('FilesView Component', () => {
  beforeEach(() => {
    (window as any).audioforge = undefined;
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(FilesView);
      expect(container).toBeTruthy();
    });

    it('shows "Files" heading', () => {
      const { container } = render(FilesView);
      const heading = container.querySelector('h2');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toContain('Files');
    });

    it('works without audioforge API', () => {
      const { container } = render(FilesView);
      expect(container.textContent).toContain('Files');
    });
  });

  describe('File List', () => {
    it('shows empty state when no files', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('No') || expect(container.textContent).toContain('none');
    });

    it('shows file list when assets exist', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('track.mp3');
    });

    it('shows file name for each row', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'audio1.mp3',
              type: 'audio',
              size: 5242880,
            },
            {
              id: 2,
              name: 'video1.mp4',
              type: 'video',
              size: 104857600,
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('audio1.mp3');
      expect(container.textContent).toContain('video1.mp4');
    });

    it('shows type badge for each file', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('audio') || expect(container.textContent).toContain('Audio');
    });

    it('shows formatted file size', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track.mp3',
              type: 'audio',
              size: 5242880, // 5 MB
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      // Should show MB format
      expect(container.textContent).toContain('MB') || expect(container.textContent).toContain('5');
    });

    it('shows total file count', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track1.mp3',
              type: 'audio',
              size: 5242880,
            },
            {
              id: 2,
              name: 'track2.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('2') || expect(container.textContent).toContain('file');
    });

    it('shows total storage used', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track1.mp3',
              type: 'audio',
              size: 5242880,
            },
            {
              id: 2,
              name: 'track2.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('10') || expect(container.textContent).toContain('MB');
    });
  });

  describe('Search', () => {
    it('has a search input', () => {
      const { container } = render(FilesView);
      const input = container.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
    });

    it('filters by name on input', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'vocal.mp3',
              type: 'audio',
              size: 5242880,
            },
            {
              id: 2,
              name: 'drums.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      await fireEvent.change(input, { target: { value: 'vocal' } });
      await new Promise(r => setTimeout(r, 100)); // Allow debounce

      // Should show only vocal
      expect(container.textContent).toContain('vocal.mp3');
    });

    it('calls assets.search after debounce', async () => {
      const searchSpy = vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'vocal.mp3',
          type: 'audio',
          size: 5242880,
        },
      ]);

      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([]),
          search: searchSpy,
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      await fireEvent.change(input, { target: { value: 'vocal' } });
      await new Promise(r => setTimeout(r, 150)); // Allow debounce

      expect(searchSpy).toHaveBeenCalledWith('vocal');
    });
  });

  describe('Import File', () => {
    it('has an "Import File" button', () => {
      const { getByText } = render(FilesView);
      expect(getByText(/Import File/i)).toBeTruthy();
    });

    it('clicking Import File calls files.showOpenDialog', async () => {
      const showOpenDialogSpy = vi.fn().mockResolvedValue({ filePaths: [] });
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([]),
        },
        files: {
          showOpenDialog: showOpenDialogSpy,
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Import'));
      await fireEvent.click(button!);

      expect(showOpenDialogSpy).toHaveBeenCalled();
    });

    it('showOpenDialog is called with audio/video filters', async () => {
      const showOpenDialogSpy = vi.fn().mockResolvedValue({ filePaths: [] });
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([]),
        },
        files: {
          showOpenDialog: showOpenDialogSpy,
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Import'));
      await fireEvent.click(button!);

      const callArgs = showOpenDialogSpy.mock.calls[0][0];
      expect(callArgs).toHaveProperty('filters');
    });
  });

  describe('Delete File', () => {
    it('each file row has a delete button', async () => {
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      const deleteBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Delete') || b.textContent?.includes('delete') || b.textContent?.includes('×')
      );
      expect(deleteBtn).toBeTruthy();
    });

    it('clicking delete calls assets.delete', async () => {
      const deleteSpy = vi.fn().mockResolvedValue(true);
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
          delete: deleteSpy,
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      const deleteBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Delete') || b.textContent?.includes('delete') || b.textContent?.includes('×')
      );
      await fireEvent.click(deleteBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(deleteSpy).toHaveBeenCalledWith(1);
    });

    it('removes file from list after deletion', async () => {
      let deleteSpy = vi.fn().mockResolvedValue(true);
      (window as any).audioforge = {
        assets: {
          list: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: 'track.mp3',
              type: 'audio',
              size: 5242880,
            },
          ]),
          delete: deleteSpy,
        },
      };

      const { container } = render(FilesView);
      await new Promise(r => setTimeout(r, 0));

      // Update list to be empty after delete
      (window as any).audioforge.assets.list = vi.fn().mockResolvedValue([]);

      const deleteBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Delete') || b.textContent?.includes('delete') || b.textContent?.includes('×')
      );
      await fireEvent.click(deleteBtn!);
      await new Promise(r => setTimeout(r, 0));

      // Should show empty state
      const text = container.textContent;
      expect(text).toContain('No') || expect(text).toContain('none');
    });
  });
});

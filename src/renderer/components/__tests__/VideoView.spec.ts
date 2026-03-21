// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import VideoView from '../VideoView.svelte';

describe('VideoView Component', () => {
  beforeEach(() => {
    (window as any).audioforge = undefined;
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(VideoView);
      expect(container).toBeTruthy();
    });

    it('shows "Video" heading', () => {
      const { container } = render(VideoView);
      expect(container.querySelector('h2')).toBeTruthy();
      expect(container.querySelector('h2')?.textContent).toContain('Video');
    });

    it('shows "Import Video" button', () => {
      const { getByText } = render(VideoView);
      expect(getByText(/Import Video/i)).toBeTruthy();
    });

    it('works without audioforge API', () => {
      const { container } = render(VideoView);
      expect(container.textContent).toContain('Video');
    });

    it('shows empty state if no video imported yet', () => {
      const { container } = render(VideoView);
      const emptyState = container.textContent;
      expect(emptyState).toContain('No video') || expect(emptyState).toContain('Import');
    });
  });

  describe('Import Video', () => {
    it('clicking import calls files.showOpenDialog', async () => {
      const showOpenDialogSpy = vi.fn().mockResolvedValue({ filePaths: [] });
      (window as any).audioforge = {
        files: {
          showOpenDialog: showOpenDialogSpy,
        },
      };

      const { getByText } = render(VideoView);
      const importBtn = getByText(/Import Video/i);

      await fireEvent.click(importBtn);
      expect(showOpenDialogSpy).toHaveBeenCalled();
    });

    it('files.showOpenDialog is called with video filters', async () => {
      const showOpenDialogSpy = vi.fn().mockResolvedValue({ filePaths: [] });
      (window as any).audioforge = {
        files: {
          showOpenDialog: showOpenDialogSpy,
        },
      };

      const { getByText } = render(VideoView);
      const importBtn = getByText(/Import Video/i);

      await fireEvent.click(importBtn);

      // Check that call included filters
      const callArgs = showOpenDialogSpy.mock.calls[0][0];
      expect(callArgs).toHaveProperty('filters');
    });

    it('shows filename after file is selected', async () => {
      const getMetadataSpy = vi.fn().mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
      });

      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: getMetadataSpy,
        },
      };

      const { container } = render(VideoView);
      await new Promise(r => setTimeout(r, 0));

      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('video.mp4');
    });
  });

  describe('File Metadata', () => {
    it('shows duration', async () => {
      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      // Duration 120 seconds = 2:00 format
      expect(container.textContent).toContain('2:00') || expect(container.textContent).toContain('Duration');
    });

    it('shows resolution as width×height', async () => {
      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('1920') && expect(container.textContent).toContain('1080');
    });

    it('shows codec', async () => {
      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('h264');
    });
  });

  describe('Extract Audio', () => {
    it('shows "Extract Audio" button after file is loaded', async () => {
      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      const buttons = Array.from(container.querySelectorAll('button'));
      expect(buttons.some(b => b.textContent?.includes('Extract Audio'))).toBe(true);
    });

    it('clicking extract audio calls video.extractAudio with file path', async () => {
      const extractAudioSpy = vi.fn().mockResolvedValue(true);
      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
          extractAudio: extractAudioSpy,
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      const buttons = Array.from(container.querySelectorAll('button'));
      const extractBtn = buttons.find(b => b.textContent?.includes('Extract Audio'));
      await fireEvent.click(extractBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(extractAudioSpy).toHaveBeenCalled();
      expect(extractAudioSpy.mock.calls[0][0]).toBe('/path/to/video.mp4');
    });

    it('shows "Extracting…" state while extracting', async () => {
      let resolveExtract: any;
      const extractPromise = new Promise(r => {
        resolveExtract = r;
      });

      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
          extractAudio: vi.fn().mockReturnValue(extractPromise),
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      const buttons = Array.from(container.querySelectorAll('button'));
      const extractBtn = buttons.find(b => b.textContent?.includes('Extract Audio'));
      await fireEvent.click(extractBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('Extracting');

      resolveExtract(true);
      await new Promise(r => setTimeout(r, 0));
    });

    it('shows success message after extraction completes', async () => {
      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
          extractAudio: vi.fn().mockResolvedValue(true),
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      const buttons = Array.from(container.querySelectorAll('button'));
      const extractBtn = buttons.find(b => b.textContent?.includes('Extract Audio'));
      await fireEvent.click(extractBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('success') || expect(container.textContent).toContain('Success');
    });

    it('shows error message if extraction fails', async () => {
      (window as any).audioforge = {
        files: {
          showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/video.mp4'] }),
        },
        video: {
          getMetadata: vi.fn().mockResolvedValue({
            duration: 120,
            width: 1920,
            height: 1080,
            codec: 'h264',
          }),
          extractAudio: vi.fn().mockRejectedValue(new Error('Extract failed')),
        },
      };

      const { container } = render(VideoView);
      const importBtn = container.querySelector('button');
      await fireEvent.click(importBtn!);
      await new Promise(r => setTimeout(r, 0));

      const buttons = Array.from(container.querySelectorAll('button'));
      const extractBtn = buttons.find(b => b.textContent?.includes('Extract Audio'));
      await fireEvent.click(extractBtn!);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent?.toLowerCase()).toContain('error');
    });
  });
});

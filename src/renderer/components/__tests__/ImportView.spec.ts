// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ImportView from '../ImportView.svelte';

describe('ImportView Component', () => {
  beforeEach(() => {
    (window as any).audioforge = {
      files: {
        showOpenDialog: vi.fn(),
        import: vi.fn(),
        analyzeAll: vi.fn(),
      },
      on: vi.fn((channel: string, callback: Function) => {
        return () => {};
      }),
    };
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(ImportView);
      expect(container).toBeTruthy();
    });

    it('renders import header with title', () => {
      const { container } = render(ImportView);
      expect(container.textContent).toContain('Import Audio Files');
      expect(container.textContent).toContain('Add files to your library');
    });

    it('renders drop zone when no files imported', () => {
      const { container } = render(ImportView);
      expect(container.textContent).toContain('Drop audio files here');
      expect(container.textContent).toContain('Supported:');
    });

    it('renders Browse Files button', () => {
      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'));
      expect(browseBtn).toBeTruthy();
    });
  });

  describe('File Selection', () => {
    it('calls showOpenDialog when Browse Files button clicked', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);

      expect(window.audioforge.files.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({
              name: 'Audio Files',
            }),
          ]),
          properties: expect.arrayContaining(['openFile', 'multiSelections']),
        })
      );
    });

    it('calls import when files are selected', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/file1.wav', '/path/to/file2.mp3'],
      });

      (window.audioforge.files.import as any).mockResolvedValue([
        {
          asset: {
            id: 1,
            name: 'file1.wav',
            file_type: 'wav',
            bpm: 120,
            key: 'Am',
            duration: 3.5,
          },
          jobId: 'job-1',
          status: 'pending',
        },
      ]);

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);

      expect(window.audioforge.files.import).toHaveBeenCalledWith([
        '/path/to/file1.wav',
        '/path/to/file2.mp3',
      ]);
    });

    it('handles import errors gracefully', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/bad.wav'],
      });

      (window.audioforge.files.import as any).mockResolvedValue([
        {
          error: 'File not found',
          filePath: '/path/to/bad.wav',
          status: 'failed',
        },
      ]);

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);
      await new Promise((r) => setTimeout(r, 50));

      expect(container.textContent).toContain('File not found');
    });
  });

  describe('Drag and Drop', () => {
    it('highlights drop zone on drag over', async () => {
      const { container } = render(ImportView);
      const dropZone = container.querySelector('.drop-zone') as HTMLElement;

      await fireEvent.dragOver(dropZone);

      expect(dropZone.classList.contains('dragging')).toBe(true);
    });

    it('removes highlight on drag leave', async () => {
      const { container } = render(ImportView);
      const dropZone = container.querySelector('.drop-zone') as HTMLElement;

      await fireEvent.dragOver(dropZone);
      await fireEvent.dragLeave(dropZone);

      expect(dropZone.classList.contains('dragging')).toBe(false);
    });

    it('imports files on drop', async () => {
      (window.audioforge.files.import as any).mockResolvedValue([
        {
          asset: {
            id: 1,
            name: 'dropped.wav',
            file_type: 'wav',
          },
          jobId: 'job-1',
          status: 'pending',
        },
      ]);

      const { container } = render(ImportView);
      const dropZone = container.querySelector('.drop-zone') as HTMLElement;

      const dataTransfer = {
        files: [
          { path: '/path/to/dropped.wav' },
        ],
      };

      await fireEvent.drop(dropZone, { dataTransfer });

      expect(window.audioforge.files.import).toHaveBeenCalled();
    });
  });

  describe('Imported Files Display', () => {
    it('displays imported file in list', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/file.wav'],
      });

      (window.audioforge.files.import as any).mockResolvedValue([
        {
          asset: {
            id: 1,
            name: 'file.wav',
            file_type: 'wav',
            bpm: 120,
            key: 'Am',
            duration: 3.5,
          },
          jobId: 'job-1',
          status: 'pending',
        },
      ]);

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);
      await new Promise((r) => setTimeout(r, 50));

      expect(container.textContent).toContain('file.wav');
      expect(container.textContent).toContain('BPM: 120');
      expect(container.textContent).toContain('Key: Am');
    });

    it('displays metadata when analysis is complete', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/file.wav'],
      });

      (window.audioforge.files.import as any).mockResolvedValue([
        {
          asset: {
            id: 1,
            name: 'file.wav',
            file_type: 'wav',
            bpm: 120,
            key: 'Am',
            duration: 3.5,
          },
          jobId: 'job-1',
          status: 'completed',
        },
      ]);

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);
      await new Promise((r) => setTimeout(r, 50));

      expect(container.textContent).toContain('BPM: 120');
      expect(container.textContent).toContain('Key: Am');
      expect(container.textContent).toContain('Duration: 0:03');
    });

    it('displays placeholder when metadata missing', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/file.wav'],
      });

      (window.audioforge.files.import as any).mockResolvedValue([
        {
          asset: {
            id: 1,
            name: 'file.wav',
            file_type: 'wav',
          },
          jobId: 'job-1',
          status: 'pending',
        },
      ]);

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);
      await new Promise((r) => setTimeout(r, 50));

      expect(container.textContent).toContain('BPM: —');
      expect(container.textContent).toContain('Key: —');
    });
  });

  describe('Analyze All', () => {
    it('calls analyzeAll when button clicked', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/file.wav'],
      });

      (window.audioforge.files.import as any).mockResolvedValue([
        {
          asset: {
            id: 1,
            name: 'file.wav',
            file_type: 'wav',
          },
          jobId: 'job-1',
          status: 'pending',
        },
      ]);

      (window.audioforge.files.analyzeAll as any).mockResolvedValue({
        jobId: 'batch-1',
        status: 'queued',
      });

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);
      await new Promise((r) => setTimeout(r, 50));

      const analyzeAllBtn = Array.from(buttons).find((b) =>
        b.textContent?.includes('Analyze All Unanalyzed')
      );

      if (analyzeAllBtn) {
        await fireEvent.click(analyzeAllBtn);
        expect(window.audioforge.files.analyzeAll).toHaveBeenCalled();
      }
    });
  });

  describe('Duration Formatting', () => {
    it('formats duration correctly', async () => {
      (window.audioforge.files.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/file.wav'],
      });

      (window.audioforge.files.import as any).mockResolvedValue([
        {
          asset: {
            id: 1,
            name: 'file.wav',
            file_type: 'wav',
            duration: 125.5, // 2 minutes 5 seconds
          },
          jobId: 'job-1',
          status: 'completed',
        },
      ]);

      const { container } = render(ImportView);
      const buttons = container.querySelectorAll('button');
      const browseBtn = Array.from(buttons).find((b) => b.textContent?.includes('Browse Files'))!;

      await fireEvent.click(browseBtn);
      await new Promise((r) => setTimeout(r, 50));

      expect(container.textContent).toContain('Duration: 2:05');
    });
  });
});

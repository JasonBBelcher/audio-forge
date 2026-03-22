// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import KoalaKitBuilder from '../KoalaKitBuilder.svelte';

// Mock confirm for tests
global.confirm = vi.fn(() => true);

describe('KoalaKitBuilder Component', () => {
  let mockAf: any;

  beforeEach(() => {
    (global.confirm as any).mockReturnValue(true);
    mockAf = {
      koala: {
        exportKit: vi.fn().mockResolvedValue({ success: true, path: '/output/My_Kit' }),
        listKits: vi.fn().mockResolvedValue([]),
        deleteKit: vi.fn().mockResolvedValue({}),
      },
      assets: {
        list: vi.fn().mockResolvedValue([]),
        search: vi.fn().mockResolvedValue([]),
      },
      settings: {
        get: vi.fn().mockReturnValue(''),
        set: vi.fn().mockResolvedValue({}),
      },
      files: {
        getMediaDir: vi.fn().mockResolvedValue('/media'),
        showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/sync'] }),
      },
    };
    (window as any).audioforge = mockAf;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Layout & Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(KoalaKitBuilder);
      expect(container).toBeTruthy();
    });

    it('renders header with kit name input', () => {
      const { container } = render(KoalaKitBuilder);
      const input = container.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
      expect(input?.placeholder).toContain('My Kit');
    });

    it('renders BPM input', () => {
      const { container } = render(KoalaKitBuilder);
      const input = container.querySelector('input[type="number"]');
      expect(input).toBeTruthy();
      expect(input?.placeholder).toContain('120');
    });

    it('renders 4 bank sections', () => {
      const { container } = render(KoalaKitBuilder);
      expect(container.textContent).toContain('Bank A');
      expect(container.textContent).toContain('Bank B');
      expect(container.textContent).toContain('Bank C');
      expect(container.textContent).toContain('Bank D');
    });

    it('renders 16 pads per bank = 64 total pads', () => {
      const { container } = render(KoalaKitBuilder);
      const pads = container.querySelectorAll('[data-testid^="pad-"]');
      expect(pads.length).toBe(64);
    });

    it('renders export button', () => {
      const { container } = render(KoalaKitBuilder);
      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export'));
      expect(exportBtn).toBeTruthy();
    });

    it('renders clear all button', () => {
      const { container } = render(KoalaKitBuilder);
      const buttons = container.querySelectorAll('button');
      const clearBtn = Array.from(buttons).find(b => b.textContent?.includes('Clear All'));
      expect(clearBtn).toBeTruthy();
    });

    it('renders sync folder display', () => {
      const { container } = render(KoalaKitBuilder);
      expect(container.textContent).toContain('Sync Folder') || expect(container.textContent).toContain('sync');
    });
  });

  describe('Pad Interactions', () => {
    it('empty pad shows number and dashed border', () => {
      const { container } = render(KoalaKitBuilder);
      const pad1 = container.querySelector('[data-testid="pad-A-1"]');
      expect(pad1).toBeTruthy();
      expect(pad1?.textContent).toContain('1');
    });

    it('clicking empty pad opens sample picker', async () => {
      const { container } = render(KoalaKitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'snare.wav', file_path: '/samples/snare.wav', file_type: 'audio', file_size: 1024 },
      ]);

      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 50));

      // Sample picker should appear with search input
      const searchInput = container.querySelector('input[type="text"]');
      expect(searchInput).toBeTruthy();
    });

    it('sample picker shows asset list from audioforge.assets.list()', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
        { id: 2, name: 'snare.wav', file_path: '/samples/snare.wav', file_type: 'audio', file_size: 1024 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 50));

      expect(container.textContent).toContain('kick.wav');
      expect(container.textContent).toContain('snare.wav');
    });

    it('clicking asset in picker assigns sample to pad', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      // Find the sample item button in the picker
      const sampleItems = container.querySelectorAll('.sample-item');
      expect(sampleItems.length).toBeGreaterThan(0);

      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));

        // Pad should now show sample name
        const updatedPad = container.querySelector('[data-testid="pad-A-1"]');
        expect(updatedPad?.textContent).toContain('kick.wav');
      }
    });

    it('assigned pad shows sample name', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'snare.wav', file_path: '/samples/snare.wav', file_type: 'audio', file_size: 1024 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
        expect(pad.textContent).toContain('snare.wav');
      }
    });

    it('clicking assigned pad shows clear option', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      // First assignment
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      // Click again to show clear dialog
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      // confirm should have been called
      expect(global.confirm).toHaveBeenCalled();
    });

    it('clearing a pad removes assignment', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      // Assign a sample
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      // Verify pad has sample
      expect(pad.textContent).toContain('kick.wav');

      // Clear it - confirm is called and returns true
      (global.confirm as any).mockReturnValue(true);
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      // Pad should be empty again
      expect(pad.textContent).not.toContain('kick.wav');
      expect(pad.textContent).toContain('1');
    });
  });

  describe('Export Functionality', () => {
    it('export button is disabled when kit has no name', () => {
      const { container } = render(KoalaKitBuilder);
      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
      expect(exportBtn?.disabled).toBe(true);
    });

    it('export button is disabled when no pads assigned', async () => {
      const { container } = render(KoalaKitBuilder);
      const kitNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;

      await fireEvent.change(kitNameInput, { target: { value: 'My Kit' } });
      await new Promise(r => setTimeout(r, 50));

      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
      expect(exportBtn?.disabled).toBe(true);
    });

    it('export button is enabled when kit name and 1+ pads assigned', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const kitNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;

      await fireEvent.change(kitNameInput, { target: { value: 'My Kit' } });
      await new Promise(r => setTimeout(r, 100));

      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
      expect(exportBtn?.disabled).toBe(false);
    });

    it('calls exportKit with correct kit structure', async () => {
      mockAf.settings.get.mockResolvedValue('/sync');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const kitNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      const bpmInput = container.querySelector('input[type="number"]') as HTMLInputElement;

      await fireEvent.change(kitNameInput, { target: { value: 'Test Kit' } });
      await fireEvent.change(bpmInput, { target: { value: '100' } });
      await new Promise(r => setTimeout(r, 150));

      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLElement;

      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 150));

      expect(mockAf.koala.exportKit).toHaveBeenCalled();
      const callArgs = mockAf.koala.exportKit.mock.calls[0];
      expect(callArgs[0]).toEqual({
        name: 'Test Kit',
        bpm: 100,
        pads: expect.arrayContaining([
          expect.objectContaining({
            bank: 'A',
            pad: 1,
            samplePath: '/samples/kick.wav',
          }),
        ]),
      });
    });

    it('shows success message on export completion', async () => {
      mockAf.settings.get.mockResolvedValue('/sync');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);
      mockAf.koala.exportKit.mockResolvedValue({ success: true, path: '/output/Test_Kit' });

      const { container } = render(KoalaKitBuilder);
      const kitNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;

      await fireEvent.change(kitNameInput, { target: { value: 'Test Kit' } });
      await new Promise(r => setTimeout(r, 100));

      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLElement;

      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 200));

      expect(container.textContent).toContain('exported');
    });

    it('shows error message on export failure', async () => {
      mockAf.settings.get.mockResolvedValue('/sync');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);
      mockAf.koala.exportKit.mockRejectedValue(new Error('Export failed'));

      const { container } = render(KoalaKitBuilder);
      const kitNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;

      await fireEvent.change(kitNameInput, { target: { value: 'Test Kit' } });
      await new Promise(r => setTimeout(r, 100));

      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLElement;

      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 200));

      expect(container.textContent).toContain('failed');
    });
  });

  describe('Clear All', () => {
    it('clear all button clears all pad assignments', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);

      // Assign samples to multiple pads
      const pad1 = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;
      const pad2 = container.querySelector('[data-testid="pad-A-2"]') as HTMLElement;

      for (const pad of [pad1, pad2]) {
        await fireEvent.click(pad);
        await new Promise(r => setTimeout(r, 100));

        const sampleItems = container.querySelectorAll('.sample-item');
        if (sampleItems.length > 0) {
          await fireEvent.click(sampleItems[0]);
          await new Promise(r => setTimeout(r, 100));
        }
      }

      // Click clear all
      const buttons = container.querySelectorAll('button');
      const clearBtn = Array.from(buttons).find(b => b.textContent?.includes('Clear All')) as HTMLElement;

      (global.confirm as any).mockReturnValue(true);
      await fireEvent.click(clearBtn);
      await new Promise(r => setTimeout(r, 100));

      // All pads should be empty
      expect(container.querySelector('[data-testid="pad-A-1"]')?.textContent).not.toContain('kick.wav');
      expect(container.querySelector('[data-testid="pad-A-2"]')?.textContent).not.toContain('kick.wav');
    });
  });

  describe('Sync Folder', () => {
    it('loads sync folder from settings on mount', async () => {
      mockAf.settings.get.mockResolvedValue('/path/to/koala/sync');

      const { container } = render(KoalaKitBuilder);
      await new Promise(r => setTimeout(r, 50));

      expect(mockAf.settings.get).toHaveBeenCalledWith('koala.syncFolder');
    });

    it('shows "Not set" when no sync folder configured', () => {
      mockAf.settings.get.mockResolvedValue('');

      const { container } = render(KoalaKitBuilder);

      expect(container.textContent).toContain('Not set') || expect(container.textContent).toContain('sync');
    });

    it('change button opens file picker', async () => {
      mockAf.settings.get.mockResolvedValue('/path/to/koala');

      const { container } = render(KoalaKitBuilder);
      await new Promise(r => setTimeout(r, 50));

      const buttons = container.querySelectorAll('button');
      const changeBtn = Array.from(buttons).find(b => b.textContent?.includes('Change')) as HTMLElement;

      if (changeBtn) {
        await fireEvent.click(changeBtn);
        await new Promise(r => setTimeout(r, 50));

        expect(mockAf.files.showOpenDialog).toHaveBeenCalled();
      }
    });

    it('saves new sync folder to settings', async () => {
      mockAf.settings.get.mockResolvedValue('/path/to/koala');
      mockAf.files.showOpenDialog.mockResolvedValue({ filePaths: ['/new/path'] });

      const { container } = render(KoalaKitBuilder);
      await new Promise(r => setTimeout(r, 50));

      const buttons = container.querySelectorAll('button');
      const changeBtn = Array.from(buttons).find(b => b.textContent?.includes('Change')) as HTMLElement;

      if (changeBtn) {
        await fireEvent.click(changeBtn);
        await new Promise(r => setTimeout(r, 100));

        expect(mockAf.settings.set).toHaveBeenCalledWith('koala.syncFolder', '/new/path');
      }
    });
  });

  describe('BPM Input', () => {
    it('BPM input is optional', () => {
      const { container } = render(KoalaKitBuilder);
      const bpmInput = container.querySelector('input[type="number"]') as HTMLInputElement;
      expect(bpmInput?.required).toBe(false);
    });

    it('BPM is included in export when provided', async () => {
      mockAf.settings.get.mockResolvedValue('/sync');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const kitNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      const bpmInput = container.querySelector('input[type="number"]') as HTMLInputElement;

      await fireEvent.change(kitNameInput, { target: { value: 'Test Kit' } });
      await fireEvent.change(bpmInput, { target: { value: '140' } });
      await new Promise(r => setTimeout(r, 150));

      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLElement;

      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 150));

      expect(mockAf.koala.exportKit).toHaveBeenCalled();
      const callArgs = mockAf.koala.exportKit.mock.calls[0];
      expect(callArgs[0].bpm).toBe(140);
    });

    it('BPM is undefined when empty in export', async () => {
      mockAf.settings.get.mockResolvedValue('/sync');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(KoalaKitBuilder);
      const kitNameInput = container.querySelector('input[type="text"]') as HTMLInputElement;

      await fireEvent.change(kitNameInput, { target: { value: 'Test Kit' } });
      await new Promise(r => setTimeout(r, 100));

      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLElement;

      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 150));

      expect(mockAf.koala.exportKit).toHaveBeenCalled();
      const callArgs = mockAf.koala.exportKit.mock.calls[0];
      expect(callArgs[0].bpm).toBeUndefined();
    });
  });
});

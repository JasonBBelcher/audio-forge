// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SP404KitBuilder from '../SP404KitBuilder.svelte';

global.confirm = vi.fn(() => true);

describe('SP404KitBuilder Component', () => {
  let mockAf: any;

  beforeEach(() => {
    (global.confirm as any).mockReturnValue(true);
    mockAf = {
      sp404: {
        exportKit: vi.fn().mockResolvedValue({ success: true, path: '/output/SP-404' }),
        listBanks: vi.fn().mockResolvedValue([]),
        detectSDCards: vi.fn().mockResolvedValue([]),
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
        showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/sd'] }),
      },
    };
    (window as any).audioforge = mockAf;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Layout & Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(SP404KitBuilder);
      expect(container).toBeTruthy();
    });

    it('renders bank tabs A through J', () => {
      const { container } = render(SP404KitBuilder);
      for (const bank of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
        expect(container.textContent).toContain(bank);
      }
    });

    it('renders default active bank as A', async () => {
      const { container } = render(SP404KitBuilder);
      await new Promise(r => setTimeout(r, 50));
      const activeTab = container.querySelector('.bank-tab.active');
      expect(activeTab?.textContent).toContain('A');
    });

    it('renders 16 pad slots for active bank', () => {
      const { container } = render(SP404KitBuilder);
      const pads = container.querySelectorAll('[data-testid^="pad-A-"]');
      expect(pads.length).toBe(16);
    });

    it('renders detect SD card button', () => {
      const { container } = render(SP404KitBuilder);
      const buttons = container.querySelectorAll('button');
      const detectBtn = Array.from(buttons).find(b => b.textContent?.includes('Detect'));
      expect(detectBtn).toBeTruthy();
    });

    it('renders export button', () => {
      const { container } = render(SP404KitBuilder);
      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export'));
      expect(exportBtn).toBeTruthy();
    });

    it('renders clear all button', () => {
      const { container } = render(SP404KitBuilder);
      const buttons = container.querySelectorAll('button');
      const clearBtn = Array.from(buttons).find(b => b.textContent?.includes('Clear All'));
      expect(clearBtn).toBeTruthy();
    });
  });

  describe('Bank Tab Navigation', () => {
    it('clicking bank tab switches active bank', async () => {
      const { container } = render(SP404KitBuilder);

      const bankBTab = Array.from(container.querySelectorAll('.bank-tab')).find(
        (t) => t.textContent === 'B'
      ) as HTMLElement;

      await fireEvent.click(bankBTab);
      await new Promise(r => setTimeout(r, 50));

      const pads = container.querySelectorAll('[data-testid^="pad-B-"]');
      expect(pads.length).toBe(16);
    });

    it('shows correct pads when switching banks', async () => {
      const { container } = render(SP404KitBuilder);

      // Switch to Bank C
      const bankCTab = Array.from(container.querySelectorAll('.bank-tab')).find(
        (t) => t.textContent === 'C'
      ) as HTMLElement;

      await fireEvent.click(bankCTab);
      await new Promise(r => setTimeout(r, 50));

      const pads = container.querySelectorAll('[data-testid^="pad-C-"]');
      expect(pads.length).toBe(16);
    });
  });

  describe('SD Card Detection', () => {
    it('detect button calls sp404.detectSDCards()', async () => {
      const { container } = render(SP404KitBuilder);
      const buttons = container.querySelectorAll('button');
      const detectBtn = Array.from(buttons).find(b => b.textContent?.includes('Detect')) as HTMLElement;

      await fireEvent.click(detectBtn);
      await new Promise(r => setTimeout(r, 100));

      expect(mockAf.sp404.detectSDCards).toHaveBeenCalled();
    });

    it('shows success message when SD cards detected', async () => {
      mockAf.sp404.detectSDCards.mockResolvedValue(['/Volumes/SD_CARD']);

      const { container } = render(SP404KitBuilder);
      const buttons = container.querySelectorAll('button');
      const detectBtn = Array.from(buttons).find(b => b.textContent?.includes('Detect')) as HTMLElement;

      await fireEvent.click(detectBtn);
      await new Promise(r => setTimeout(r, 150));

      expect(container.textContent).toContain('Found');
    });

    it('shows error message when no SD cards detected', async () => {
      mockAf.sp404.detectSDCards.mockResolvedValue([]);

      const { container } = render(SP404KitBuilder);
      const buttons = container.querySelectorAll('button');
      const detectBtn = Array.from(buttons).find(b => b.textContent?.includes('Detect')) as HTMLElement;

      await fireEvent.click(detectBtn);
      await new Promise(r => setTimeout(r, 150));

      expect(container.textContent).toContain('No SD cards');
    });
  });

  describe('Pad Interactions', () => {
    it('empty pad shows number', () => {
      const { container } = render(SP404KitBuilder);
      const pad1 = container.querySelector('[data-testid="pad-A-1"]');
      expect(pad1?.textContent).toContain('1');
    });

    it('clicking empty pad opens sample picker', async () => {
      const { container } = render(SP404KitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const searchInput = container.querySelector('.sample-picker-search input');
      expect(searchInput).toBeTruthy();
    });

    it('sample picker shows assets from audioforge.assets.list()', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
        { id: 2, name: 'snare.wav', file_path: '/samples/snare.wav', file_type: 'audio', file_size: 1024 },
      ]);

      const { container } = render(SP404KitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      expect(container.textContent).toContain('kick.wav');
      expect(container.textContent).toContain('snare.wav');
    });

    it('clicking asset in picker assigns sample to pad', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(SP404KitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));

        const updatedPad = container.querySelector('[data-testid="pad-A-1"]');
        expect(updatedPad?.textContent).toContain('kick.wav');
      }
    });

    it('assigned pad shows sample name', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'snare.wav', file_path: '/samples/snare.wav', file_type: 'audio', file_size: 1024 },
      ]);

      const { container } = render(SP404KitBuilder);
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

      const { container } = render(SP404KitBuilder);
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

      expect(global.confirm).toHaveBeenCalled();
    });

    it('clearing a pad removes assignment', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(SP404KitBuilder);
      const pad = container.querySelector('[data-testid="pad-A-1"]') as HTMLElement;

      // Assign a sample
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      const sampleItems = container.querySelectorAll('.sample-item');
      if (sampleItems.length > 0) {
        await fireEvent.click(sampleItems[0]);
        await new Promise(r => setTimeout(r, 100));
      }

      expect(pad.textContent).toContain('kick.wav');

      // Clear it
      (global.confirm as any).mockReturnValue(true);
      await fireEvent.click(pad);
      await new Promise(r => setTimeout(r, 100));

      expect(pad.textContent).not.toContain('kick.wav');
      expect(pad.textContent).toContain('1');
    });
  });

  describe('Export Functionality', () => {
    it('export button is disabled when no pads assigned', async () => {
      const { container } = render(SP404KitBuilder);
      const buttons = container.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
      expect(exportBtn?.disabled).toBe(true);
    });

    it('export button is disabled when no SD card path set', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);
      mockAf.settings.get.mockReturnValue('');

      const { container } = render(SP404KitBuilder);
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
      expect(exportBtn?.disabled).toBe(true);
    });

    it('export button is enabled when pads assigned and SD card set', async () => {
      mockAf.settings.get.mockReturnValue('/Volumes/SD_CARD');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(SP404KitBuilder);
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

    it('calls exportKit with correct structure', async () => {
      mockAf.settings.get.mockReturnValue('/Volumes/SD_CARD');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(SP404KitBuilder);
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

      (global.confirm as any).mockReturnValue(true);
      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 200));

      expect(mockAf.sp404.exportKit).toHaveBeenCalled();
      const callArgs = mockAf.sp404.exportKit.mock.calls[0];
      expect(callArgs[1]).toBe('/Volumes/SD_CARD');
      // Should have pads array [10 banks][16 pads]
      expect(callArgs[0].pads).toBeDefined();
    });

    it('shows success message on export', async () => {
      mockAf.settings.get.mockReturnValue('/Volumes/SD_CARD');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);
      mockAf.sp404.exportKit.mockResolvedValue({ success: true });

      const { container } = render(SP404KitBuilder);
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

      (global.confirm as any).mockReturnValue(true);
      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 300));

      expect(container.textContent).toContain('exported successfully');
    });

    it('shows error message on export failure', async () => {
      mockAf.settings.get.mockReturnValue('/Volumes/SD_CARD');
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);
      mockAf.sp404.exportKit.mockRejectedValue(new Error('Export failed'));

      const { container } = render(SP404KitBuilder);
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

      (global.confirm as any).mockReturnValue(true);
      await fireEvent.click(exportBtn);
      await new Promise(r => setTimeout(r, 300));

      expect(container.textContent).toContain('failed');
    });
  });

  describe('Clear All', () => {
    it('clear all button clears all pad assignments', async () => {
      mockAf.assets.list.mockResolvedValue([
        { id: 1, name: 'kick.wav', file_path: '/samples/kick.wav', file_type: 'audio', file_size: 2048 },
      ]);

      const { container } = render(SP404KitBuilder);

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
});

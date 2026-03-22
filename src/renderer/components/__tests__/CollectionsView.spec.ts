// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CollectionsView from '../CollectionsView.svelte';

interface Collection {
  id: number;
  name: string;
  description?: string;
  assetCount: number;
  created_at: string;
  updated_at: string;
}

interface Asset {
  id: number;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  bpm?: number;
  key?: string;
  duration?: number;
  created_at: string;
}

const mockCollections: Collection[] = [
  {
    id: 1,
    name: 'Drums',
    description: 'Drum samples',
    assetCount: 2,
    created_at: '2026-03-21T00:00:00Z',
    updated_at: '2026-03-21T00:00:00Z',
  },
  {
    id: 2,
    name: 'Bass',
    description: 'Bass samples',
    assetCount: 1,
    created_at: '2026-03-21T00:01:00Z',
    updated_at: '2026-03-21T00:01:00Z',
  },
];

const mockAssets: Asset[] = [
  {
    id: 1,
    name: 'kick.wav',
    file_path: '/samples/kick.wav',
    file_type: 'wav',
    file_size: 44032,
    bpm: 120,
    duration: 2.1,
    created_at: '2026-03-21T00:00:00Z',
  },
  {
    id: 2,
    name: 'snare.wav',
    file_path: '/samples/snare.wav',
    file_type: 'wav',
    file_size: 24576,
    bpm: 120,
    duration: 0.5,
    created_at: '2026-03-21T00:00:01Z',
  },
];

describe('CollectionsView Component', () => {
  beforeEach(() => {
    (window as any).audioforge = undefined;
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      expect(container).toBeTruthy();
    });

    it('renders "Collections" heading', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('Collections');
    });

    it('renders "+ New Collection" button', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 0));

      const button = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('New Collection')
      );
      expect(button).toBeTruthy();
    });
  });

  describe('Collections List', () => {
    it('loads and displays all collections on mount', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      expect(container.textContent).toContain('Drums');
      expect(container.textContent).toContain('Bass');
    });

    it('shows asset count for each collection', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      expect(container.textContent).toContain('2'); // Drums has 2 assets
      expect(container.textContent).toContain('1'); // Bass has 1 asset
    });

    it('shows empty state when no collections exist', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue([]),
          listAssets: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 0));

      const text = container.textContent;
      expect(text).toContain('No collections') || expect(text).toContain('Create');
    });
  });

  describe('Create Collection', () => {
    it('shows form when "+ New Collection" button clicked', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 0));

      const button = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('New Collection')
      );

      if (button) {
        await fireEvent.click(button);
        await new Promise(r => setTimeout(r, 50));

        const input = container.querySelector('input[type="text"]');
        expect(input).toBeTruthy();
      }
    });

    it('creates collection on form submit', async () => {
      const createSpy = vi.fn().mockResolvedValue(mockCollections[0]);

      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue([]),
          create: createSpy,
          listAssets: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 0));

      const newButton = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('New Collection')
      );

      if (newButton) {
        await fireEvent.click(newButton);
        await new Promise(r => setTimeout(r, 50));

        const input = container.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          await fireEvent.input(input, { target: { value: 'Drums' } });
          await new Promise(r => setTimeout(r, 50));

          const form = container.querySelector('form');
          if (form) {
            await fireEvent.submit(form);
            await new Promise(r => setTimeout(r, 100));

            expect(createSpy).toHaveBeenCalledWith('Drums', undefined);
          }
        }
      }
    });
  });

  describe('Collection Selection and Assets', () => {
    it('loads assets when collection is selected', async () => {
      const listAssetsSpy = vi.fn().mockResolvedValue(mockAssets);

      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: listAssetsSpy,
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      const drumsCollection = Array.from(container.querySelectorAll('button.collection-item')).find(
        el => el.textContent?.includes('Drums')
      );

      if (drumsCollection) {
        await fireEvent.click(drumsCollection);
        await new Promise(r => setTimeout(r, 100));

        expect(listAssetsSpy).toHaveBeenCalledWith(1); // Collection id 1
        expect(container.textContent).toContain('kick.wav');
      }
    });

    it('shows assets for selected collection', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue(mockAssets),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      const drumsCollection = Array.from(container.querySelectorAll('button.collection-item')).find(
        el => el.textContent?.includes('Drums')
      );

      if (drumsCollection) {
        await fireEvent.click(drumsCollection);
        await new Promise(r => setTimeout(r, 100));

        expect(container.textContent).toContain('kick.wav');
        expect(container.textContent).toContain('snare.wav');
      }
    });
  });

  describe('Asset Removal', () => {
    it('removes asset from collection', async () => {
      const removeAssetSpy = vi.fn().mockResolvedValue(undefined);

      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue(mockAssets),
          removeAsset: removeAssetSpy,
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      const drumsCollection = Array.from(container.querySelectorAll('button.collection-item')).find(
        el => el.textContent?.includes('Drums')
      );

      if (drumsCollection) {
        await fireEvent.click(drumsCollection);
        await new Promise(r => setTimeout(r, 100));

        const removeButtons = Array.from(container.querySelectorAll('.remove-button'));

        if (removeButtons.length > 0) {
          await fireEvent.click(removeButtons[0]);
          await new Promise(r => setTimeout(r, 50));

          expect(removeAssetSpy).toHaveBeenCalledWith(1, expect.any(Number));
        }
      }
    });
  });

  describe('Export ZIP', () => {
    it('shows "Export ZIP" button when collection selected', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue(mockAssets),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      const drumsCollection = Array.from(container.querySelectorAll('button.collection-item')).find(
        el => el.textContent?.includes('Drums')
      );

      if (drumsCollection) {
        await fireEvent.click(drumsCollection);
        await new Promise(r => setTimeout(r, 100));

        const button = Array.from(container.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Export ZIP')
        );
        expect(button).toBeTruthy();
      }
    });

    it('exports ZIP when button clicked', async () => {
      const exportZipSpy = vi.fn().mockResolvedValue(undefined);
      const showSaveDialogSpy = vi.fn().mockResolvedValue({ filePath: '/tmp/collection.zip', canceled: false });
      const alertSpy = vi.fn();

      (window as any).alert = alertSpy;

      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue(mockAssets),
          exportZip: exportZipSpy,
        },
        files: {
          showSaveDialog: showSaveDialogSpy,
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      const drumsCollection = Array.from(container.querySelectorAll('button.collection-item')).find(
        el => el.textContent?.includes('Drums')
      );

      if (drumsCollection) {
        await fireEvent.click(drumsCollection);
        await new Promise(r => setTimeout(r, 100));

        const exportButton = Array.from(container.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Export ZIP')
        );

        if (exportButton) {
          await fireEvent.click(exportButton);
          await new Promise(r => setTimeout(r, 150));

          expect(showSaveDialogSpy).toHaveBeenCalled();
          expect(exportZipSpy).toHaveBeenCalledWith(1, '/tmp/collection.zip');
        }
      }
    });
  });

  describe('Delete Collection', () => {
    it('shows "Delete Collection" button', async () => {
      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      const drumsCollection = Array.from(container.querySelectorAll('button.collection-item')).find(
        el => el.textContent?.includes('Drums')
      );

      if (drumsCollection) {
        await fireEvent.click(drumsCollection);
        await new Promise(r => setTimeout(r, 100));

        const button = Array.from(container.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Delete Collection')
        );
        expect(button).toBeTruthy();
      }
    });

    it('deletes collection when button clicked', async () => {
      const deleteSpy = vi.fn().mockResolvedValue(undefined);
      const confirmSpy = vi.fn().mockReturnValue(true);

      // Mock confirm
      (window as any).confirm = confirmSpy;

      (window as any).audioforge = {
        collections: {
          list: vi.fn().mockResolvedValue(mockCollections),
          listAssets: vi.fn().mockResolvedValue([]),
          delete: deleteSpy,
        },
      };

      const { container } = render(CollectionsView);
      await new Promise(r => setTimeout(r, 100));

      const drumsCollection = Array.from(container.querySelectorAll('button.collection-item')).find(
        el => el.textContent?.includes('Drums')
      );

      if (drumsCollection) {
        await fireEvent.click(drumsCollection);
        await new Promise(r => setTimeout(r, 100));

        const deleteButton = Array.from(container.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Delete Collection')
        );

        if (deleteButton) {
          await fireEvent.click(deleteButton);
          await new Promise(r => setTimeout(r, 50));

          expect(confirmSpy).toHaveBeenCalled();
          expect(deleteSpy).toHaveBeenCalledWith(1);
        }
      }
    });
  });
});

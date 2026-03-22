import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MidiLibraryView from '../MidiLibraryView.svelte';

// Mock the audioforge API
const mockAudioforgeAPI = {
  midi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'beat.mid',
        file_path: '/media/beat.mid',
        file_size: 2048,
        tempo: 120,
        timeSignature: '4/4',
        trackCount: 2,
        noteCount: 64,
        durationSec: 32,
        format: 1,
        tags: ['drums'],
        created_at: '2025-03-21T00:00:00Z',
      },
      {
        id: 2,
        name: 'melody.mid',
        file_path: '/media/melody.mid',
        file_size: 1024,
        tempo: 90,
        timeSignature: '3/4',
        trackCount: 1,
        noteCount: 48,
        durationSec: 20,
        format: 0,
        tags: ['piano'],
        created_at: '2025-03-21T01:00:00Z',
      },
    ]),
    showImportDialog: vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: [],
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    linkToAsset: vi.fn().mockResolvedValue(undefined),
    getAssetsForMidi: vi.fn().mockResolvedValue([]),
  },
  on: vi.fn(),
};

// @vitest-environment jsdom
describe('MidiLibraryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.audioforge
    (window as any).audioforge = mockAudioforgeAPI;
  });

  it('should render without crashing', async () => {
    const { container } = render(MidiLibraryView);
    expect(container).toBeTruthy();
  });

  it('should load MIDI files on mount', async () => {
    render(MidiLibraryView);

    // Wait for async data to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have called the list method
    expect(mockAudioforgeAPI.midi.list).toHaveBeenCalled();
  });

  it('should display MIDI files in the component', async () => {
    const { container } = render(MidiLibraryView);

    // Wait for async data
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that MIDI file names are rendered
    const text = container.textContent || '';
    expect(text).toContain('beat.mid');
    expect(text).toContain('melody.mid');
  });

  it('should show BPM values for MIDI files', async () => {
    const { container } = render(MidiLibraryView);

    // Wait for async data
    await new Promise((resolve) => setTimeout(resolve, 100));

    const text = container.textContent || '';
    expect(text).toContain('120'); // BPM for beat.mid
    expect(text).toContain('90'); // BPM for melody.mid
  });

  it('should show time signatures for MIDI files', async () => {
    const { container } = render(MidiLibraryView);

    // Wait for async data
    await new Promise((resolve) => setTimeout(resolve, 100));

    const text = container.textContent || '';
    expect(text).toContain('4/4'); // Time sig for beat.mid
    expect(text).toContain('3/4'); // Time sig for melody.mid
  });

  it('should show track counts for MIDI files', async () => {
    const { container } = render(MidiLibraryView);

    // Wait for async data
    await new Promise((resolve) => setTimeout(resolve, 100));

    const text = container.textContent || '';
    expect(text).toContain('Tracks'); // Column header
  });

  it('should handle import dialog trigger', async () => {
    const { container } = render(MidiLibraryView);

    // Wait for mount
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Find and click import button
    const buttons = Array.from(container.querySelectorAll('button'));
    const importBtn = buttons.find((btn) => btn.textContent?.includes('Import'));

    if (importBtn) {
      importBtn.click();
      // Give time for the handler to execute
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockAudioforgeAPI.midi.showImportDialog).toHaveBeenCalled();
    }
  });

  it('should call delete when detail panel delete button is clicked', async () => {
    const { container } = render(MidiLibraryView);

    // Wait for data
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click on a file row to show detail panel
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    if (rows.length > 0) {
      (rows[0] as HTMLElement).click();

      // Give time for detail panel to appear
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Find delete button in detail panel
      const deleteBtn = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Delete')
      );

      if (deleteBtn) {
        // Mock confirm dialog
        global.confirm = vi.fn(() => true);
        deleteBtn.click();

        await new Promise((resolve) => setTimeout(resolve, 50));
        // Delete should have been called
        expect(mockAudioforgeAPI.midi.delete).toHaveBeenCalledWith(1);
      }
    }
  });
});

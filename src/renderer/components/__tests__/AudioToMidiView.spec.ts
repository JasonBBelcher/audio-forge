import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import AudioToMidiView from '../AudioToMidiView.svelte';

describe('AudioToMidiView', () => {
  let mockAf: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAf = {
      audioToMidi: {
        isInstalled: vi.fn().mockResolvedValue({ installed: true }),
        install: vi.fn().mockResolvedValue({ jobId: 'install-job-123' }),
        convert: vi.fn().mockResolvedValue({ jobId: 'convert-job-456' }),
      },
      files: {
        list: vi.fn().mockResolvedValue([
          { id: 1, name: 'song.wav', file_path: '/media/song.wav', bpm: 120 },
        ]),
        showOpenDialog: vi.fn().mockResolvedValue({
          canceled: false,
          filePaths: ['/home/user/audio.wav'],
        }),
        getMediaDir: vi.fn().mockResolvedValue('/media'),
        import: vi.fn().mockResolvedValue({ id: 2 }),
        revealInFinder: vi.fn().mockResolvedValue(undefined),
        showSaveDialog: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: '/home/user/export.mid',
        }),
        readAsArrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
      on: vi.fn().mockReturnValue(() => {}),
    };

    (window as any).audioforge = mockAf;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(AudioToMidiView);
    expect(container).toBeTruthy();
  });

  it('shows "Basic Pitch" status text when installed', async () => {
    mockAf.audioToMidi.isInstalled.mockResolvedValue({ installed: true });
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('Basic Pitch')).toBeTruthy();
      expect(screen.getByText('Ready')).toBeTruthy();
    });
  });

  it('shows install button when NOT installed', async () => {
    mockAf.audioToMidi.isInstalled.mockResolvedValue({ installed: false });
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('Install')).toBeTruthy();
      expect(screen.getByText('Not installed')).toBeTruthy();
    });
  });

  it('clicking install button calls af.audioToMidi.install', async () => {
    mockAf.audioToMidi.isInstalled.mockResolvedValue({ installed: false });
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('Install')).toBeTruthy();
    });

    const installBtn = screen.getByText('Install');
    await fireEvent.click(installBtn);

    expect(mockAf.audioToMidi.install).toHaveBeenCalled();
  });

  it('shows "Browse..." button for source file selection', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText(/Browse/)).toBeTruthy();
    });
  });

  it('library list loads on mount (calls af.files.list)', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(mockAf.files.list).toHaveBeenCalled();
    });
  });

  it('clicking a library asset selects it', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('song.wav')).toBeTruthy();
    });

    const libraryItem = screen.getByText('song.wav');
    await fireEvent.click(libraryItem);

    // After selection, the file should appear in the selected area
    await waitFor(() => {
      const selectedItems = screen.getAllByText('song.wav');
      expect(selectedItems.length).toBeGreaterThanOrEqual(2); // library + selected
    });
  });

  it('shows onset sensitivity slider/control', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('Onset Sensitivity')).toBeTruthy();
    });
  });

  it('shows frame sensitivity slider/control', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('Frame Sensitivity')).toBeTruthy();
    });
  });

  it('shows min note length control', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText(/Min Note Length/)).toBeTruthy();
    });
  });

  it('shows min and max frequency controls', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText(/Min Freq/)).toBeTruthy();
      expect(screen.getByText(/Max Freq/)).toBeTruthy();
    });
  });

  it('convert button is present and disabled when no file selected', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      const convertBtn = screen.getByText(/Convert to MIDI/);
      expect(convertBtn).toBeTruthy();
      expect((convertBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('convert button is enabled when file is selected and installed', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('song.wav')).toBeTruthy();
    });

    const libraryItem = screen.getByText('song.wav');
    await fireEvent.click(libraryItem);

    await waitFor(() => {
      const convertBtn = screen.getByText(/Convert to MIDI/) as HTMLButtonElement;
      expect(convertBtn.disabled).toBe(false);
    });
  });

  it('after conversion, shows MIDI path or note count in result', async () => {
    mockAf.audioToMidi.convert.mockResolvedValue({
      jobId: 'convert-job-456',
    });

    const { rerender } = render(AudioToMidiView);

    // Simulate selecting a file and converting
    await waitFor(() => {
      expect(screen.getByText('song.wav')).toBeTruthy();
    });

    const libraryItem = screen.getByText('song.wav');
    await fireEvent.click(libraryItem);

    // Trigger conversion
    const convertBtn = screen.getByText(/Convert to MIDI/);
    await fireEvent.click(convertBtn);

    // Simulate job:complete event for conversion
    const onCallback = mockAf.on.mock.calls.find(
      (call: any) => call[0] === 'job:complete'
    );
    if (onCallback) {
      onCallback[1]({
        jobId: 'convert-job-456',
        result: {
          midiPath: '/out/song/song_basic_pitch.mid',
          noteCount: 42,
          durationSec: 8.5,
          estimatedTempo: 120,
        },
      });
    }

    rerender(AudioToMidiView, {});

    // After conversion, result should be visible
    await waitFor(() => {
      expect(screen.queryByText(/Conversion Complete/)).toBeTruthy();
    });
  });

  it('after conversion, shows "Save to Library" button (calls af.files.import)', async () => {
    const { rerender } = render(AudioToMidiView);

    // Simulate conversion completion
    const onCallback = mockAf.on.mock.calls.find(
      (call: any) => call[0] === 'job:complete'
    );
    if (onCallback) {
      onCallback[1]({
        jobId: 'convert-job-456',
        result: {
          midiPath: '/out/song/song_basic_pitch.mid',
          noteCount: 42,
          durationSec: 8.5,
          estimatedTempo: 120,
        },
      });
    }

    rerender(AudioToMidiView, {});

    await waitFor(() => {
      expect(screen.getByText(/Save to Library/)).toBeTruthy();
    });

    const saveBtn = screen.getByText(/Save to Library/);
    await fireEvent.click(saveBtn);

    expect(mockAf.files.import).toHaveBeenCalledWith(['/out/song/song_basic_pitch.mid']);
  });

  it('after conversion, shows "Show in Finder" button (calls af.files.revealInFinder)', async () => {
    const { rerender } = render(AudioToMidiView);

    // Simulate conversion completion
    const onCallback = mockAf.on.mock.calls.find(
      (call: any) => call[0] === 'job:complete'
    );
    if (onCallback) {
      onCallback[1]({
        jobId: 'convert-job-456',
        result: {
          midiPath: '/out/song/song_basic_pitch.mid',
          noteCount: 42,
          durationSec: 8.5,
          estimatedTempo: 120,
        },
      });
    }

    rerender(AudioToMidiView, {});

    await waitFor(() => {
      expect(screen.getByText('Show in Finder')).toBeTruthy();
    });

    const revealBtn = screen.getByText('Show in Finder');
    await fireEvent.click(revealBtn);

    expect(mockAf.files.revealInFinder).toHaveBeenCalledWith('/out/song/song_basic_pitch.mid');
  });

  it('convert button calls af.audioToMidi.convert with inputPath and outputDir', async () => {
    render(AudioToMidiView);

    await waitFor(() => {
      expect(screen.getByText('song.wav')).toBeTruthy();
    });

    const libraryItem = screen.getByText('song.wav');
    await fireEvent.click(libraryItem);

    const convertBtn = screen.getByText(/Convert to MIDI/);
    await fireEvent.click(convertBtn);

    await waitFor(() => {
      expect(mockAf.audioToMidi.convert).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPath: '/media/song.wav',
          outputDir: '/media',
        })
      );
    });
  });

  it('shows error message when conversion fails', async () => {
    const { rerender } = render(AudioToMidiView);

    // Simulate conversion failure
    const onCallback = mockAf.on.mock.calls.find(
      (call: any) => call[0] === 'job:failed'
    );
    if (onCallback) {
      onCallback[1]({
        jobId: 'convert-job-456',
        error: 'Conversion process timed out',
      });
    }

    rerender(AudioToMidiView, {});

    await waitFor(() => {
      expect(screen.getByText('Conversion process timed out')).toBeTruthy();
    });
  });

  it('shows "Export as..." button to export MIDI file', async () => {
    const { rerender } = render(AudioToMidiView);

    // Simulate conversion completion
    const onCallback = mockAf.on.mock.calls.find(
      (call: any) => call[0] === 'job:complete'
    );
    if (onCallback) {
      onCallback[1]({
        jobId: 'convert-job-456',
        result: {
          midiPath: '/out/song/song_basic_pitch.mid',
          noteCount: 42,
          durationSec: 8.5,
          estimatedTempo: 120,
        },
      });
    }

    rerender(AudioToMidiView, {});

    await waitFor(() => {
      expect(screen.getByText('Export as…')).toBeTruthy();
    });
  });
});

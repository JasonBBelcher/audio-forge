import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import MasteringView from '../MasteringView.svelte';

describe('MasteringView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock canvas API for EQ visualization
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      quadraticCurveTo: vi.fn(),
      clearRect: vi.fn(),
    });
  });

  it('renders Mastering heading', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText('Mastering')).toBeTruthy();
  });

  it('renders Browse... button', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText(/Browse/)).toBeTruthy();
  });

  it('renders EQ section with band labels', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText('EQ')).toBeTruthy();
    expect(screen.getByText('LOW SHELF')).toBeTruthy();
    expect(screen.getByText('MID PEAK')).toBeTruthy();
    expect(screen.getByText('HIGH SHELF')).toBeTruthy();
  });

  it('renders Compressor section with control labels', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText('COMPRESSOR')).toBeTruthy();
    expect(screen.getByText('Threshold (dB)')).toBeTruthy();
    expect(screen.getByText('Ratio')).toBeTruthy();
  });

  it('renders Target LUFS slider control', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText('Target LUFS')).toBeTruthy();
  });

  it('renders streaming/club/broadcast preset buttons', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText(/Streaming/)).toBeTruthy();
    expect(screen.getByText(/Club/)).toBeTruthy();
    expect(screen.getByText(/Broadcast/)).toBeTruthy();
  });

  it('clicking streaming preset sets targetLufs to -14', async () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    const streamingBtn = screen.getByText(/Streaming/);
    await fireEvent.click(streamingBtn);

    // Find the Target LUFS input and check its value
    const targetLufsInputs = screen.getAllByDisplayValue('-14.0');
    expect(targetLufsInputs.length).toBeGreaterThan(0);
  });

  it('renders Master & Export button disabled when no file selected', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    const masterBtn = screen.getByText(/Master & Export/);
    expect((masterBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('loads library assets on mount', async () => {
    const mockList = vi.fn().mockResolvedValue([
      { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
    ]);
    const mockAf = {
      files: { list: mockList },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });
  });

  it('displays library assets after loading', async () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });
  });

  it('selects library asset when clicked', async () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    // Check that file is selected (should display in selected-badge)
    expect(screen.getByText('track.wav')).toBeTruthy();
  });

  it('clicking Analyze calls af.mastering.analyze with selected file path', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      inputLufs: -18,
      inputPeakDb: -3,
      inputDynamicRange: 8,
    });
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: mockAnalyze,
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    // Select the library item
    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    // Click Analyze button
    await waitFor(() => {
      const analyzeBtn = screen.getByText('Analyze');
      expect(analyzeBtn).toBeTruthy();
    });

    const analyzeBtn = screen.getByText('Analyze');
    await fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith('/media/track.wav');
    });
  });

  it('displays LUFS value after analysis', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      inputLufs: -18,
      inputPeakDb: -3,
      inputDynamicRange: 8,
    });
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: mockAnalyze,
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    // Select file
    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    // Run analysis
    const analyzeBtn = screen.getByText('Analyze');
    await fireEvent.click(analyzeBtn);

    // Wait for analysis results
    await waitFor(() => {
      expect(screen.getByText('Input LUFS')).toBeTruthy();
      expect(screen.getByText('-18.0')).toBeTruthy();
    });
  });

  it('clicking Master & Export calls showSaveDialog and master', async () => {
    const mockMaster = vi.fn().mockResolvedValue(undefined);
    const mockShowSaveDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: '/out/mastered.wav',
    });
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: vi.fn(),
        master: mockMaster,
        showSaveDialog: mockShowSaveDialog,
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    // Select file
    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    // Click Master & Export
    const masterBtn = screen.getByText(/Master & Export/);
    await fireEvent.click(masterBtn);

    // Wait for save dialog and master to be called
    await waitFor(() => {
      expect(mockShowSaveDialog).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockMaster).toHaveBeenCalled();
    });
  });

  it('shows Import to Library button after successful mastering', async () => {
    const mockMaster = vi.fn().mockResolvedValue(undefined);
    const mockShowSaveDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: '/out/mastered.wav',
    });
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: vi.fn(),
        master: mockMaster,
        showSaveDialog: mockShowSaveDialog,
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    // Select file
    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    // Click Master & Export
    const masterBtn = screen.getByText(/Master & Export/);
    await fireEvent.click(masterBtn);

    // Wait for success and check for Import button
    await waitFor(() => {
      expect(screen.getByText('Import to Library')).toBeTruthy();
    });
  });

  it('clicking Import to Library calls af.files.import with output path', async () => {
    const mockImport = vi.fn().mockResolvedValue(undefined);
    const mockMaster = vi.fn().mockResolvedValue(undefined);
    const mockShowSaveDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: '/out/mastered.wav',
    });
    const mockAf = {
      files: {
        list: vi.fn().mockResolvedValue([
          { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
        ]),
        import: mockImport,
      },
      mastering: {
        analyze: vi.fn(),
        master: mockMaster,
        showSaveDialog: mockShowSaveDialog,
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    // Select file
    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    // Click Master & Export
    const masterBtn = screen.getByText(/Master & Export/);
    await fireEvent.click(masterBtn);

    // Wait for Import button and click it
    await waitFor(() => {
      expect(screen.getByText('Import to Library')).toBeTruthy();
    });

    const importBtn = screen.getByText('Import to Library');
    await fireEvent.click(importBtn);

    // Verify import was called with output path
    await waitFor(() => {
      expect(mockImport).toHaveBeenCalledWith(['/out/mastered.wav']);
    });
  });

  it('shows empty state when no library assets', async () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('No assets in library')).toBeTruthy();
    });
  });

  it('disables Analyze button when no file selected', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    // Analyze button should not be visible when no file selected
    expect(screen.queryByText('Analyze')).toBeFalsy();
  });

  it('clicking club preset sets targetLufs to -8', async () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    const clubBtn = screen.getByText(/Club/);
    await fireEvent.click(clubBtn);

    const targetLufsInputs = screen.getAllByDisplayValue('-8.0');
    expect(targetLufsInputs.length).toBeGreaterThan(0);
  });

  it('clicking broadcast preset sets targetLufs to -23', async () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    const broadcastBtn = screen.getByText(/Broadcast/);
    await fireEvent.click(broadcastBtn);

    const targetLufsInputs = screen.getAllByDisplayValue('-23.0');
    expect(targetLufsInputs.length).toBeGreaterThan(0);
  });

  it('renders Loudness & Limiter section', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText('LOUDNESS & LIMITER')).toBeTruthy();
  });

  it('renders True Peak Ceiling control', () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);
    expect(screen.getByText('True Peak Ceiling (dBTP)')).toBeTruthy();
  });

  it('renders Reveal in Finder button after successful mastering', async () => {
    const mockMaster = vi.fn().mockResolvedValue(undefined);
    const mockShowSaveDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: '/out/mastered.wav',
    });
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: vi.fn(),
        master: mockMaster,
        showSaveDialog: mockShowSaveDialog,
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    const masterBtn = screen.getByText(/Master & Export/);
    await fireEvent.click(masterBtn);

    await waitFor(() => {
      expect(screen.getByText('Reveal in Finder')).toBeTruthy();
    });
  });

  it('shows analyzing state while detection is in progress', async () => {
    const mockAnalyze = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                inputLufs: -18,
                inputPeakDb: -3,
                inputDynamicRange: 8,
              }),
            100
          )
        )
    );
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: mockAnalyze,
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    const analyzeBtn = screen.getByText('Analyze');
    await fireEvent.click(analyzeBtn);

    // Button should show "Analyzing..." while in progress
    expect(screen.queryByText('Analyzing...')).toBeTruthy();
  });

  it('Master & Export button becomes enabled after file selection', async () => {
    const mockAf = {
      files: { list: vi.fn().mockResolvedValue([
        { id: 1, name: 'track.wav', file_path: '/media/track.wav', bpm: 120, key: 'Am' },
      ]) },
      mastering: {
        analyze: vi.fn(),
        master: vi.fn(),
        showSaveDialog: vi.fn(),
      },
    };
    (window as any).audioforge = mockAf;

    render(MasteringView);

    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });

    // Button should be disabled initially
    let masterBtn = screen.getByText(/Master & Export/) as HTMLButtonElement;
    expect(masterBtn.disabled).toBe(true);

    // Select a file
    const libraryItem = screen.getByText('track.wav');
    await fireEvent.click(libraryItem);

    // Button should now be enabled
    await waitFor(() => {
      masterBtn = screen.getByText(/Master & Export/) as HTMLButtonElement;
      expect(masterBtn.disabled).toBe(false);
    });
  });
});

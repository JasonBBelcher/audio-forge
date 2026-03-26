import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LoopDetectorPanel from '../LoopDetectorPanel.svelte';

describe('LoopDetectorPanel', () => {
  const mockLibraryAsset = {
    id: 1,
    name: 'track.wav',
    file_path: '/media/track.wav',
    bpm: 120,
    key: 'Am',
  };

  const mockLoopCandidate = {
    startSec: 0,
    endSec: 2,
    durationSec: 2,
    confidence: 0.9,
    bars: 2,
    bpm: 120,
  };

  const mockDetect = vi.fn().mockResolvedValue({
    loops: [mockLoopCandidate],
    suggestedBpm: 120,
    totalDuration: 60,
  });

  const mockExtract = vi.fn().mockResolvedValue('/media/track_loop_2bar.wav');

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).audioforge = {
      files: {
        list: vi.fn().mockResolvedValue([mockLibraryAsset]),
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
        import: vi.fn().mockResolvedValue([{ id: 2 }]),
        readAsArrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      },
      loop: {
        detect: mockDetect,
        extract: mockExtract,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test: Left panel renders "Source File" section
  it('renders "Source File" section label', () => {
    render(LoopDetectorPanel, { props: {} });
    expect(screen.getByText('Source File')).toBeTruthy();
  });

  // Test: Browse button is rendered
  it('renders "Browse…" button', () => {
    render(LoopDetectorPanel, { props: {} });
    expect(screen.getByText('Browse…')).toBeTruthy();
  });

  // Test: Library assets load on mount
  it('loads library assets on mount', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Wait for library to load
    await waitFor(() => {
      expect((window as any).audioforge.files.list).toHaveBeenCalled();
    });
  });

  // Test: Library assets are displayed
  it('displays library assets', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Wait for the library asset to appear
    await waitFor(() => {
      expect(screen.getByText('track.wav')).toBeTruthy();
    });
  });

  // Test: Clicking a library asset selects it
  it('selects library asset when clicked', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Wait for asset to appear
    await waitFor(() => {
      expect(screen.getAllByText('track.wav').length).toBeGreaterThan(0);
    });

    // Click the asset button in the library (find by asset-name span)
    const assetNameSpans = screen.getAllByText('track.wav');
    const assetButton = assetNameSpans[assetNameSpans.length - 1].closest('button');
    await fireEvent.click(assetButton!);

    // Asset button should now have the 'active' class
    expect(assetButton?.classList.contains('active')).toBe(true);
  });

  // Test: Detect Loops button is present
  it('renders "Detect Loops" button', () => {
    render(LoopDetectorPanel, { props: {} });
    expect(screen.getByText('🔁 Detect Loops')).toBeTruthy();
  });

  // Test: Detect button is disabled when no file selected
  it('disables "Detect Loops" button when no file is selected', () => {
    render(LoopDetectorPanel, { props: {} });
    const detectButton = screen.getByText('🔁 Detect Loops') as HTMLButtonElement;
    expect(detectButton.disabled).toBe(true);
  });

  // Test: Detect button is enabled when file is selected
  it('enables "Detect Loops" button when file is selected', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Wait for library to load
    await waitFor(() => {
      expect(screen.getAllByText('track.wav').length).toBeGreaterThan(0);
    });

    // Select the asset (from library list)
    const assetNameSpans = screen.getAllByText('track.wav');
    const assetButton = assetNameSpans[assetNameSpans.length - 1].closest('button');
    await fireEvent.click(assetButton!);

    // Detect button should now be enabled
    const detectButton = screen.getByText('🔁 Detect Loops') as HTMLButtonElement;
    expect(detectButton.disabled).toBe(false);
  });

  // Test: Clicking Detect Loops calls af.loop.detect
  it('calls af.loop.detect with file path when Detect Loops is clicked', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Wait for library to load and select a file
    await waitFor(() => {
      expect(screen.getAllByText('track.wav').length).toBeGreaterThan(0);
    });

    const assetNameSpans = screen.getAllByText('track.wav');
    const assetButton = assetNameSpans[assetNameSpans.length - 1].closest('button');
    await fireEvent.click(assetButton!);

    // Click Detect button
    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    // Wait for the detect call
    await waitFor(() => {
      expect(mockDetect).toHaveBeenCalledWith('/media/track.wav', 120);
    });
  });

  // Test: Loop candidates appear after detection
  it('displays loop candidates after detection', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Wait for library to load
    await waitFor(() => {
      expect(screen.getAllByText('track.wav').length).toBeGreaterThan(0);
    });

    // Select file
    const assetNameSpans = screen.getAllByText('track.wav');
    const assetButton = assetNameSpans[assetNameSpans.length - 1].closest('button');
    await fireEvent.click(assetButton!);

    // Click Detect
    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    // Wait for Loop Candidates section to appear
    await waitFor(() => {
      expect(screen.getByText('Loop Candidates')).toBeTruthy();
    });

    // Check for loop information (2-bar, duration, confidence)
    expect(screen.getByText('2-bar')).toBeTruthy();
  });

  // Test: Shows error message when detection fails
  it('displays error message when detection fails', async () => {
    const mockFailDetect = vi.fn().mockRejectedValue(new Error('Detection error'));
    (window as any).audioforge.loop.detect = mockFailDetect;

    render(LoopDetectorPanel, { props: { filePath: '/media/track.wav' } });

    // Click Detect button
    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Detection failed:/)).toBeTruthy();
    });
  });

  // Test: Detect button shows loading state
  it('shows loading state while detecting', async () => {
    // Create a detect function that takes time to resolve
    const slowDetect = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                loops: [mockLoopCandidate],
                suggestedBpm: 120,
                totalDuration: 60,
              }),
            200
          )
        )
    );
    (window as any).audioforge.loop.detect = slowDetect;

    render(LoopDetectorPanel, { props: { filePath: '/media/track.wav' } });

    // Click Detect
    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    // Should show "Detecting…" while request is in flight
    await waitFor(() => {
      expect(screen.getByText('Detecting…')).toBeTruthy();
    });
  });

  // Test: Extract button appears for detected loop
  it('displays Extract button when loops are detected', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Wait for library and select file
    await waitFor(() => {
      expect(screen.getAllByText('track.wav').length).toBeGreaterThan(0);
    });
    const assetNameSpans = screen.getAllByText('track.wav');
    const assetButton = assetNameSpans[assetNameSpans.length - 1].closest('button');
    await fireEvent.click(assetButton!);

    // Click Detect
    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    // Wait for Extract button to appear
    await waitFor(() => {
      expect(screen.getByText(/✂ Extract/)).toBeTruthy();
    });
  });

  // Test: Clicking Extract calls af.loop.extract
  it('calls af.loop.extract when Extract button is clicked', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Load library and select file
    await waitFor(() => {
      expect(screen.getAllByText('track.wav').length).toBeGreaterThan(0);
    });
    const assetNameSpans = screen.getAllByText('track.wav');
    const assetButton = assetNameSpans[assetNameSpans.length - 1].closest('button');
    await fireEvent.click(assetButton!);

    // Detect loops
    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    // Wait for Extract button
    await waitFor(() => {
      expect(screen.getByText(/✂ Extract/)).toBeTruthy();
    });

    // Click Extract
    const extractButton = screen.getByText(/✂ Extract/);
    await fireEvent.click(extractButton);

    // Verify extract was called with file path and loop data
    await waitFor(() => {
      expect(mockExtract).toHaveBeenCalledWith('/media/track.wav', mockLoopCandidate);
    });
  });

  // Test: Success notification appears after extraction
  it('shows success notification after extraction', async () => {
    render(LoopDetectorPanel, { props: {} });

    // Load, select, detect
    await waitFor(() => {
      expect(screen.getAllByText('track.wav').length).toBeGreaterThan(0);
    });
    const assetNameSpans = screen.getAllByText('track.wav');
    const assetButton = assetNameSpans[assetNameSpans.length - 1].closest('button');
    await fireEvent.click(assetButton!);

    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    // Wait and click Extract
    await waitFor(() => {
      expect(screen.getByText(/✂ Extract/)).toBeTruthy();
    });
    const extractButton = screen.getByText(/✂ Extract/);
    await fireEvent.click(extractButton);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/extracted and added to your library/)).toBeTruthy();
    });
  });

  // Test: BPM input is present in right panel
  it('renders BPM input field', () => {
    render(LoopDetectorPanel, { props: {} });
    const bpmInput = screen.getByLabelText('BPM') as HTMLInputElement;
    expect(bpmInput).toBeTruthy();
    expect(bpmInput.placeholder).toBe('Auto');
  });

  // Test: Library section is labeled correctly
  it('renders "Library" sub-header', () => {
    render(LoopDetectorPanel, { props: {} });
    expect(screen.getByText('Library')).toBeTruthy();
  });

  // Test: Empty library state
  it('shows empty library message when no files exist', async () => {
    (window as any).audioforge.files.list = vi.fn().mockResolvedValue([]);

    render(LoopDetectorPanel, { props: {} });

    await waitFor(() => {
      expect(screen.getByText('No files in library yet')).toBeTruthy();
    });
  });

  // Test: Detect with no loops found shows error
  it('shows message when no loops are detected', async () => {
    mockDetect.mockResolvedValueOnce({
      loops: [],
      suggestedBpm: 120,
      totalDuration: 60,
    });

    render(LoopDetectorPanel, { props: { filePath: '/media/track.wav' } });

    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    await waitFor(() => {
      expect(screen.getByText(/No loop candidates found/)).toBeTruthy();
    });
  });

  // Test: BPM input is disabled while detecting
  it('disables BPM input while detecting', async () => {
    const slowDetect = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                loops: [mockLoopCandidate],
                suggestedBpm: 120,
                totalDuration: 60,
              }),
            150
          )
        )
    );
    (window as any).audioforge.loop.detect = slowDetect;

    render(LoopDetectorPanel, { props: { filePath: '/media/track.wav' } });

    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    const bpmInput = screen.getByLabelText('BPM') as HTMLInputElement;
    expect(bpmInput.disabled).toBe(true);
  });

  // Test: Browse button opens file dialog
  it('opens file dialog when Browse button is clicked', async () => {
    (window as any).audioforge.files.showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/audio.wav'],
    });

    render(LoopDetectorPanel, { props: {} });

    const browseButton = screen.getByText('Browse…');
    await fireEvent.click(browseButton);

    await waitFor(() => {
      expect((window as any).audioforge.files.showOpenDialog).toHaveBeenCalled();
    });
  });

  // Test: Selected file from browse is displayed
  it('displays selected file from browse dialog', async () => {
    (window as any).audioforge.files.showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/new-audio.wav'],
    });

    render(LoopDetectorPanel, { props: {} });

    const browseButton = screen.getByText('Browse…');
    await fireEvent.click(browseButton);

    await waitFor(() => {
      expect(screen.getByText('new-audio.wav')).toBeTruthy();
    });
  });

  // Test: Multiple loop candidates can be displayed
  it('displays multiple loop candidates', async () => {
    const multipleLoops = [
      {
        startSec: 0,
        endSec: 2,
        durationSec: 2,
        confidence: 0.95,
        bars: 2,
        bpm: 120,
      },
      {
        startSec: 0,
        endSec: 4,
        durationSec: 4,
        confidence: 0.85,
        bars: 4,
        bpm: 120,
      },
    ];

    mockDetect.mockResolvedValueOnce({
      loops: multipleLoops,
      suggestedBpm: 120,
      totalDuration: 60,
    });

    render(LoopDetectorPanel, { props: { filePath: '/media/track.wav' } });

    const detectButton = screen.getByText('🔁 Detect Loops');
    await fireEvent.click(detectButton);

    await waitFor(() => {
      expect(screen.getAllByText('2-bar').length).toBeGreaterThan(0);
      expect(screen.getAllByText('4-bar').length).toBeGreaterThan(0);
    });
  });
});

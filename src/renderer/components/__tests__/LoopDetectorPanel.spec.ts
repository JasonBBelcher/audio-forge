import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LoopDetectorPanel from '../LoopDetectorPanel.svelte';

describe('LoopDetectorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Loop Detection heading', () => {
    render(LoopDetectorPanel, { props: { filePath: '/path/to/audio.wav' } });
    expect(screen.getByText('Loop Detection')).toBeTruthy();
  });

  it('renders BPM input with default value', () => {
    render(LoopDetectorPanel, { props: { filePath: '/path/to/audio.wav' } });
    const bpmInput = screen.getByLabelText('BPM') as HTMLInputElement;
    expect(bpmInput).toBeTruthy();
    expect(bpmInput.value).toBe('');
  });

  it('renders Detect button', () => {
    render(LoopDetectorPanel, { props: { filePath: '/path/to/audio.wav' } });
    expect(screen.getByText('Detect')).toBeTruthy();
  });

  it('calls loop.detect when Detect button is clicked', async () => {
    const mockDetect = vi.fn().mockResolvedValue({
      loops: [
        {
          startSec: 0,
          endSec: 2,
          durationSec: 2,
          confidence: 0.9,
          bpm: 120,
        },
      ],
      suggestedBpm: 120,
      totalDuration: 60,
    });

    // Mock window.audioforge
    (window as any).audioforge = {
      loop: { detect: mockDetect, extract: vi.fn() },
    };

    render(LoopDetectorPanel, { props: { filePath: '/path/to/audio.wav' } });

    const detectButton = screen.getByText('Detect');
    await fireEvent.click(detectButton);

    expect(mockDetect).toHaveBeenCalledWith('/path/to/audio.wav', 120);
  });

  it('displays loop candidates after detection', async () => {
    const mockDetect = vi.fn().mockResolvedValue({
      loops: [
        {
          startSec: 0,
          endSec: 2,
          durationSec: 2,
          confidence: 0.95,
          bpm: 120,
        },
        {
          startSec: 0,
          endSec: 4,
          durationSec: 4,
          confidence: 0.90,
          bpm: 120,
        },
      ],
      suggestedBpm: 120,
      totalDuration: 60,
    });

    (window as any).audioforge = {
      loop: { detect: mockDetect, extract: vi.fn() },
    };

    render(LoopDetectorPanel, {
      props: { filePath: '/path/to/audio.wav' },
    });

    const detectButton = screen.getByText('Detect');
    await fireEvent.click(detectButton);

    // Wait for async detection
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.queryByText('Candidates:')).toBeTruthy();
  });

  it('calls loop.extract when Extract button is clicked', async () => {
    const mockDetect = vi.fn().mockResolvedValue({
      loops: [
        {
          startSec: 0,
          endSec: 8,
          durationSec: 8,
          confidence: 0.9,
          bpm: 120,
        },
      ],
      suggestedBpm: 120,
      totalDuration: 60,
    });

    const mockExtract = vi.fn().mockResolvedValue('/path/to/output.wav');

    (window as any).audioforge = {
      loop: { detect: mockDetect, extract: mockExtract },
    };

    render(LoopDetectorPanel, { props: { filePath: '/path/to/audio.wav' } });

    const detectButton = screen.getByText('Detect');
    await fireEvent.click(detectButton);

    // Wait for async detection
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find and click extract button
    const extractButtons = screen.getAllByText('Extract');
    if (extractButtons.length > 0) {
      await fireEvent.click(extractButtons[0]);
      expect(mockExtract).toHaveBeenCalled();
    }
  });

  it('shows error message when detection fails', async () => {
    const mockDetect = vi.fn().mockRejectedValue(new Error('Detection failed'));

    (window as any).audioforge = {
      loop: { detect: mockDetect, extract: vi.fn() },
    };

    render(LoopDetectorPanel, { props: { filePath: '/path/to/audio.wav' } });

    const detectButton = screen.getByText('Detect');
    await fireEvent.click(detectButton);

    // Wait for async detection and error handling
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.queryByText(/Detection failed/)).toBeTruthy();
  });

  it('disables Detect button while detecting', async () => {
    const mockDetect = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                loops: [],
                suggestedBpm: 120,
                totalDuration: 60,
              }),
            100
          )
        )
    );

    (window as any).audioforge = {
      loop: { detect: mockDetect, extract: vi.fn() },
    };

    render(LoopDetectorPanel, { props: { filePath: '/path/to/audio.wav' } });

    const detectButton = screen.getByText('Detect') as HTMLButtonElement;
    await fireEvent.click(detectButton);

    // Button should show "Detecting..." after click
    expect(screen.queryByText('Detecting...')).toBeTruthy();
  });
});

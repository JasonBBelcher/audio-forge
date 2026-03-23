import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AudioToMidiView from '../AudioToMidiView.svelte';

describe('AudioToMidiView', () => {
  beforeEach(() => {
    // Mock window.audioforge API
    (window as any).audioforge = {
      files: {
        showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['/path/to/audio.wav'] }),
        showSaveDialog: vi.fn().mockResolvedValue({ filePath: '/path/to/output.mid' }),
        getMediaDir: vi.fn().mockResolvedValue('/media'),
      },
      audioToMidi: {
        convert: vi.fn().mockResolvedValue({ jobId: 'test-job-123' }),
        importMidi: vi.fn().mockResolvedValue({ success: true }),
      },
      koala: {
        openInFinder: vi.fn().mockResolvedValue(true),
      },
      jobs: {
        getStatus: vi.fn().mockResolvedValue({ status: 'completed', result: null }),
      },
      on: () => () => {},
    };
  });

  it('renders without crashing', () => {
    const { container } = render(AudioToMidiView);
    expect(container).toBeTruthy();
  });

  it('shows file picker button', () => {
    render(AudioToMidiView);
    // Look for the button that contains "Choose File" text
    const buttons = screen.getAllByRole('button');
    const fileButton = buttons.find(btn => btn.textContent?.includes('Choose'));
    expect(fileButton).toBeTruthy();
  });

  it('shows empty state message', () => {
    render(AudioToMidiView);
    expect(screen.getByText(/Select an audio file to convert to MIDI/)).toBeTruthy();
  });

  it('displays settings controls', () => {
    render(AudioToMidiView);
    expect(screen.getByText(/Onset Sensitivity/)).toBeTruthy();
    expect(screen.getByText(/Min Note Duration/)).toBeTruthy();
    expect(screen.getByText(/Quantize to grid/)).toBeTruthy();
  });

  it('shows quantize resolution by default', () => {
    render(AudioToMidiView);
    // The default state has quantize checked, so 1/16 should be visible
    const options = screen.getAllByRole('option');
    const resolution = options.find(opt => opt.textContent === '1/16');
    expect(resolution).toBeTruthy();
  });
});

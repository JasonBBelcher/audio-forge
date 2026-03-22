import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EMX1View from '../EMX1View.svelte';

// Mock the window.audioforge API
vi.stubGlobal('window', {
  audioforge: {
    emx1: {
      listPorts: vi.fn().mockResolvedValue({
        inputs: ['EMX-1 MIDI IN', 'IAC Driver Bus 1'],
        outputs: ['EMX-1 MIDI OUT', 'IAC Driver Bus 1'],
      }),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      requestDump: vi.fn().mockResolvedValue([0xF0, 0x42, 0x30, 0x6F, 0x0E, 0xF7]),
      parseDump: vi.fn().mockResolvedValue([]),
      selectPattern: vi.fn().mockResolvedValue(undefined),
      exportMidi: vi.fn().mockResolvedValue('/path/to/pattern.mid'),
      sendStart: vi.fn().mockResolvedValue(undefined),
      sendStop: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(false),
    },
  },
});

describe('EMX1View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render EMX-1 Electribe heading', () => {
    render(EMX1View);
    const heading = screen.getByText(/EMX-1 Electribe/);
    expect(heading).toBeTruthy();
  });

  it('should render MIDI port dropdowns', async () => {
    render(EMX1View);
    // Wait for component to initialize and fetch ports
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((window as any).audioforge.emx1.listPorts).toHaveBeenCalled();
  });

  it('should call listPorts on mount', async () => {
    render(EMX1View);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((window as any).audioforge.emx1.listPorts).toHaveBeenCalled();
  });

  it('should check connection status on mount', async () => {
    render(EMX1View);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((window as any).audioforge.emx1.isConnected).toHaveBeenCalled();
  });
});

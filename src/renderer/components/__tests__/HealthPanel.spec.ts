// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// ── Mock window.audioforge ──────────────────────────────────────────────────

const mockHealthStatus = {
  tools: {
    ffmpeg: { available: true, version: '6.0.1' },
    ffprobe: { available: true, version: '6.0.1' },
    'yt-dlp': { available: true, version: '2024.01.15' },
    sox: { available: false },
    demucs: { available: false },
    aubio: { available: true, version: '0.4.9' },
  },
  system: {
    platform: 'darwin',
    arch: 'arm64',
    memory: 17179869184, // 16GB
  },
};

const mockAf = {
  health: {
    getStatus: vi.fn(),
  },
};

(window as any).audioforge = mockAf;

import HealthPanel from '../HealthPanel.svelte';

describe('HealthPanel — loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAf.health.getStatus.mockReturnValue(new Promise(() => {})); // never resolves
  });

  it('shows loading indicator on mount', () => {
    const { container } = render(HealthPanel);
    expect(container.querySelector('.loading')).toBeTruthy();
  });

  it('does not show tool list while loading', () => {
    const { container } = render(HealthPanel);
    expect(container.querySelector('.tool-list')).toBeFalsy();
  });
});

describe('HealthPanel — loaded state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAf.health.getStatus.mockResolvedValue(mockHealthStatus);
  });

  it('shows tool list after load', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelector('.tool-list')).toBeTruthy();
  });

  it('renders a row for each tool', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    const rows = container.querySelectorAll('.tool-row');
    expect(rows.length).toBe(6); // ffmpeg, ffprobe, yt-dlp, sox, demucs, aubio
  });

  it('shows tool names', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('ffmpeg');
    expect(container.textContent).toContain('yt-dlp');
    expect(container.textContent).toContain('demucs');
  });

  it('marks available tools with available indicator', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    const available = container.querySelectorAll('.status-available');
    expect(available.length).toBe(4); // ffmpeg, ffprobe, yt-dlp, aubio
  });

  it('marks unavailable tools with unavailable indicator', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    const unavailable = container.querySelectorAll('.status-unavailable');
    expect(unavailable.length).toBe(2); // sox, demucs
  });

  it('shows version string for available tools', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('6.0.1');
    expect(container.textContent).toContain('2024.01.15');
  });

  it('shows platform info', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('darwin');
  });

  it('hides loading indicator after load', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelector('.loading')).toBeFalsy();
  });

  it('shows a refresh button', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => /refresh/i.test(b.textContent ?? ''))).toBe(true);
  });

  it('clicking refresh re-calls getStatus', async () => {
    mockAf.health.getStatus.mockResolvedValue(mockHealthStatus);
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));

    const refreshBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /refresh/i.test(b.textContent ?? '')) as HTMLButtonElement;
    await fireEvent.click(refreshBtn);

    expect(mockAf.health.getStatus).toHaveBeenCalledTimes(2);
  });
});

describe('HealthPanel — error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAf.health.getStatus.mockRejectedValue(new Error('IPC error'));
  });

  it('shows error message when health check fails', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('error');
  });

  it('shows retry button on error', async () => {
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => /retry/i.test(b.textContent ?? ''))).toBe(true);
  });

  it('retry button re-calls getStatus', async () => {
    mockAf.health.getStatus.mockRejectedValue(new Error('IPC error'));
    const { container } = render(HealthPanel);
    await new Promise(r => setTimeout(r, 0));

    const retryBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /retry/i.test(b.textContent ?? '')) as HTMLButtonElement;

    mockAf.health.getStatus.mockResolvedValue(mockHealthStatus);
    await fireEvent.click(retryBtn);
    await new Promise(r => setTimeout(r, 0));

    expect(container.querySelector('.tool-list')).toBeTruthy();
  });
});

describe('HealthPanel — no audioforge API', () => {
  let original: unknown;

  beforeEach(() => {
    original = (window as any).audioforge;
    (window as any).audioforge = undefined;
  });

  afterEach(() => {
    (window as any).audioforge = original;
  });

  it('renders without crashing when API unavailable', () => {
    expect(() => render(HealthPanel)).not.toThrow();
  });
});

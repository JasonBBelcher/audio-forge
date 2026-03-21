// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// ── Mock window.audioforge ──────────────────────────────────────────────────

const makeJob = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'job-1',
  type: 'download-youtube',
  status: 'running',
  progress: 45,
  priority: 1,
  payload: { url: 'https://youtube.com/watch?v=abc' },
  retries: 0,
  maxRetries: 3,
  timeout: 1800000,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const mockAf = {
  jobs: {
    list: vi.fn(),
    cancel: vi.fn(),
  },
};

(window as any).audioforge = mockAf;

import JobsPanel from '../JobsPanel.svelte';

describe('JobsPanel — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAf.jobs.list.mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    expect(() => render(JobsPanel)).not.toThrow();
  });

  it('shows empty state message when no jobs', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toMatch(/no (active )?jobs/i);
  });

  it('does not render job rows when empty', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelector('.job-row')).toBeFalsy();
  });
});

describe('JobsPanel — jobs list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAf.jobs.list.mockResolvedValue([
      makeJob({ id: 'job-1', type: 'download-youtube', status: 'running', progress: 45 }),
      makeJob({ id: 'job-2', type: 'convert-audio', status: 'pending', progress: 0 }),
    ]);
    mockAf.jobs.cancel.mockResolvedValue(undefined);
  });

  it('renders a row for each job', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelectorAll('.job-row').length).toBe(2);
  });

  it('shows job type in each row', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('download-youtube');
    expect(container.textContent).toContain('convert-audio');
  });

  it('shows job status', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('running');
    expect(container.textContent).toContain('pending');
  });

  it('shows progress bar for running jobs', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    const bars = container.querySelectorAll('.progress-bar');
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });

  it('progress bar width reflects job progress', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    const bar = container.querySelector('.progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('45%');
  });

  it('shows progress percentage text', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('45%');
  });

  it('shows cancel button for running/pending jobs', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    const cancelBtns = Array.from(container.querySelectorAll('button'))
      .filter(b => /cancel/i.test(b.textContent ?? ''));
    expect(cancelBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking cancel calls jobs.cancel with job id', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    const cancelBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /cancel/i.test(b.textContent ?? '')) as HTMLButtonElement;
    await fireEvent.click(cancelBtn);
    expect(mockAf.jobs.cancel).toHaveBeenCalledWith('job-1');
  });
});

describe('JobsPanel — completed/failed jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAf.jobs.list.mockResolvedValue([
      makeJob({ id: 'job-3', status: 'completed', progress: 100 }),
      makeJob({ id: 'job-4', status: 'failed', progress: 30, error: 'yt-dlp crashed' }),
    ]);
  });

  it('shows completed status indicator', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('completed');
  });

  it('shows failed status indicator', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('failed');
  });

  it('shows error message for failed jobs', async () => {
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('yt-dlp crashed');
  });

  it('does not show cancel for completed jobs', async () => {
    mockAf.jobs.list.mockResolvedValue([
      makeJob({ id: 'job-3', status: 'completed', progress: 100 }),
    ]);
    const { container } = render(JobsPanel);
    await new Promise(r => setTimeout(r, 0));
    const cancelBtns = Array.from(container.querySelectorAll('button'))
      .filter(b => /cancel/i.test(b.textContent ?? ''));
    expect(cancelBtns.length).toBe(0);
  });
});

describe('JobsPanel — polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches jobs on mount', async () => {
    mockAf.jobs.list.mockResolvedValue([]);
    render(JobsPanel);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockAf.jobs.list).toHaveBeenCalledTimes(1);
  });

  it('re-fetches jobs after poll interval', async () => {
    mockAf.jobs.list.mockResolvedValue([]);
    render(JobsPanel);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockAf.jobs.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('JobsPanel — no audioforge API', () => {
  let original: unknown;

  beforeEach(() => {
    original = (window as any).audioforge;
    (window as any).audioforge = undefined;
  });

  afterEach(() => {
    (window as any).audioforge = original;
  });

  it('renders without crashing when API unavailable', () => {
    expect(() => render(JobsPanel)).not.toThrow();
  });
});

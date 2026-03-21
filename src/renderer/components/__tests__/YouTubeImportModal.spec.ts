// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// ── Mock window.audioforge ─────────────────────────────────────────────────

let progressListeners: Array<(data: any) => void> = [];

const mockAf = {
  youtube: {
    getInfo: vi.fn(),
    download: vi.fn(),
  },
  files: {
    getMediaDir: vi.fn().mockResolvedValue('/mock/media'),
  },
  on: vi.fn((channel: string, cb: (data: any) => void) => {
    if (channel === 'youtube:progress') progressListeners.push(cb);
    return () => {
      progressListeners = progressListeners.filter(l => l !== cb);
    };
  }),
};

(window as any).audioforge = mockAf;

// Don't mock Modal — render it for real so slot content is visible.
import YouTubeImportModal from '../YouTubeImportModal.svelte';

const DEFAULT_PROPS = { trackId: 'track-1', trackName: 'Track 1' };

describe('YouTubeImportModal — initial state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressListeners = [];
  });

  it('renders URL input field', () => {
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    expect(container.querySelector('input[type="url"]')).toBeTruthy();
  });

  it('renders Fetch button', () => {
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Fetch'))).toBe(true);
  });

  it('Fetch button is disabled when URL is empty', () => {
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    expect(fetchBtn.disabled).toBe(true);
  });

  it('Fetch button enables when URL is typed', async () => {
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    expect(fetchBtn.disabled).toBe(false);
  });

  it('shows the track name in the subtitle', () => {
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    expect(container.textContent).toContain('Track 1');
  });
});

describe('YouTubeImportModal — fetch info flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressListeners = [];
  });

  it('shows spinner while fetching', async () => {
    mockAf.youtube.getInfo.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('shows video title after successful fetch', async () => {
    mockAf.youtube.getInfo.mockResolvedValue({
      id: 'abc',
      title: 'Cool Beat',
      duration: 180,
      uploader: 'DJ Test',
    });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('Cool Beat');
  });

  it('shows Download Audio button in preview state', async () => {
    mockAf.youtube.getInfo.mockResolvedValue({
      id: 'abc', title: 'Cool Beat', duration: 180,
    });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    await new Promise(r => setTimeout(r, 0));
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Download'))).toBe(true);
  });

  it('shows formatted duration in preview', async () => {
    mockAf.youtube.getInfo.mockResolvedValue({
      id: 'abc', title: 'Cool Beat', duration: 185, // 3:05
    });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('3:05');
  });

  it('shows error message when fetch fails', async () => {
    mockAf.youtube.getInfo.mockRejectedValue(new Error('Invalid YouTube URL'));
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('valid YouTube URL');
  });

  it('pressing Enter in URL field triggers fetch', async () => {
    mockAf.youtube.getInfo.mockReturnValue(new Promise(() => {}));
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockAf.youtube.getInfo).toHaveBeenCalledOnce();
  });
});

describe('YouTubeImportModal — download & progress', () => {
  let jobListeners: Array<(data: any) => void> = [];
  let completeListeners: Array<(data: any) => void> = [];
  let failedListeners: Array<(data: any) => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    progressListeners = [];
    jobListeners = [];
    completeListeners = [];
    failedListeners = [];
    mockAf.youtube.getInfo.mockResolvedValue({
      id: 'abc', title: 'Cool Beat', duration: 180,
    });
    // Update mockAf.on to handle job events
    mockAf.on.mockImplementation((channel: string, cb: (data: any) => void) => {
      if (channel === 'youtube:progress') progressListeners.push(cb);
      if (channel === 'job:complete') completeListeners.push(cb);
      if (channel === 'job:failed') failedListeners.push(cb);
      return () => {
        progressListeners = progressListeners.filter(l => l !== cb);
        completeListeners = completeListeners.filter(l => l !== cb);
        failedListeners = failedListeners.filter(l => l !== cb);
      };
    });
  });

  async function reachDownloadPhase(container: HTMLElement) {
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    await new Promise(r => setTimeout(r, 0)); // preview phase
    const downloadBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Download')) as HTMLButtonElement;
    await fireEvent.click(downloadBtn);
  }

  it('shows progress bar during download', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelector('.progress-bar')).toBeTruthy();
  });

  it('shows "Downloading audio…" text during download', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('ownloading');
  });

  it('progress bar width updates when youtube:progress event fires', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));

    // Fire a progress event for this trackId
    progressListeners.forEach(cb => cb({ trackId: 'track-1', percent: 72, speed: '1.2MiB/s', eta: '00:05' }));
    await new Promise(r => setTimeout(r, 0));

    const bar = container.querySelector('.progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('72%');
  });

  it('progress text shows percent, speed, and ETA', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));

    progressListeners.forEach(cb => cb({ trackId: 'track-1', percent: 55.5, speed: '2MiB/s', eta: '00:10' }));
    await new Promise(r => setTimeout(r, 0));

    expect(container.textContent).toContain('55.5%');
    expect(container.textContent).toContain('2MiB/s');
    expect(container.textContent).toContain('00:10');
  });

  it('ignores progress events for different trackIds', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));

    progressListeners.forEach(cb => cb({ trackId: 'OTHER-TRACK', percent: 99, speed: '5MiB/s', eta: '00:01' }));
    await new Promise(r => setTimeout(r, 0));

    const bar = container.querySelector('.progress-bar') as HTMLElement;
    expect(bar.style.width).not.toBe('99%');
  });

  it('subscribes to youtube:progress on download start', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));
    expect(mockAf.on).toHaveBeenCalledWith('youtube:progress', expect.any(Function));
  });

  it('calls youtube.download with correct trackId and outputDir', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));
    expect(mockAf.youtube.download).toHaveBeenCalledWith(
      'https://youtube.com/watch?v=abc',
      'track-1',
      '/mock/media'
    );
  });

  it('shows error state when job:failed event fires', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));

    // Fire a job:failed event for this job
    failedListeners.forEach(cb => cb({ jobId: 'job-123', error: 'yt-dlp not found' }));
    await new Promise(r => setTimeout(r, 0));

    expect(container.textContent).toContain('yt-dlp');
  });

  it('shows yt-dlp install hint when job:failed mentions yt-dlp', async () => {
    mockAf.youtube.download.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    await reachDownloadPhase(container);
    await new Promise(r => setTimeout(r, 0));

    // Fire a job:failed event with yt-dlp error
    failedListeners.forEach(cb => cb({ jobId: 'job-123', error: 'yt-dlp not found. Install with: brew install yt-dlp' }));
    await new Promise(r => setTimeout(r, 0));

    expect(container.textContent).toContain('brew install yt-dlp');
  });
});

describe('YouTubeImportModal — Back / Try Again', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressListeners = [];
    mockAf.youtube.getInfo.mockResolvedValue({
      id: 'abc', title: 'Cool Beat', duration: 180,
    });
  });

  it('Back button in preview returns to input phase', async () => {
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    await new Promise(r => setTimeout(r, 0));

    const backBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Back')) as HTMLButtonElement;
    await fireEvent.click(backBtn);

    expect(container.querySelector('input[type="url"]')).toBeTruthy();
  });

  it('Try Again button in error phase returns to input', async () => {
    mockAf.youtube.getInfo.mockRejectedValue(new Error('Network error'));
    const { container } = render(YouTubeImportModal, { props: DEFAULT_PROPS });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    const fetchBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Fetch')) as HTMLButtonElement;
    await fireEvent.click(fetchBtn);
    await new Promise(r => setTimeout(r, 0));

    const retryBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Try Again')) as HTMLButtonElement;
    await fireEvent.click(retryBtn);

    expect(container.querySelector('input[type="url"]')).toBeTruthy();
  });
});

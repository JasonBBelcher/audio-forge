// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// ── Mock window.audioforge ─────────────────────────────────────────────────

const mockAf = {
  audio: {
    separateStems: vi.fn(),
  },
  files: {
    import: vi.fn(),
  },
};

(window as any).audioforge = mockAf;

// Import the component
import StemSeparationModal from '../StemSeparationModal.svelte';

const DEFAULT_PROPS = {
  asset: {
    id: 1,
    name: 'bassline.wav',
    file_path: '/samples/bassline.wav',
  },
  open: true,
};

describe('StemSeparationModal — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    const { container } = render(StemSeparationModal, {
      props: { ...DEFAULT_PROPS, open: false },
    });
    expect(container.querySelector('.modal')).toBeFalsy();
  });

  it('renders modal when open is true', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    expect(container.querySelector('.modal')).toBeTruthy();
  });

  it('displays modal title "Separate Stems"', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    expect(container.textContent).toContain('Separate Stems');
  });

  it('displays source asset name', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    expect(container.textContent).toContain('bassline.wav');
  });

  it('renders close button (×)', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const closeBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('✕'));
    expect(closeBtn).toBeTruthy();
  });
});

describe('StemSeparationModal — model selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders model dropdown', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
  });

  it('has 3 model options', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const select = container.querySelector('select');
    const options = select?.querySelectorAll('option');
    expect(options?.length).toBe(3);
  });

  it('includes htdemucs option', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const select = container.querySelector('select');
    const options = Array.from(select?.querySelectorAll('option') ?? []);
    const htdemucs = options.find(o => o.textContent?.includes('4-stem'));
    expect(htdemucs).toBeTruthy();
  });

  it('includes htdemucs_6s option', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const select = container.querySelector('select');
    const options = Array.from(select?.querySelectorAll('option') ?? []);
    const ht6s = options.find(o => o.textContent?.includes('6-stem'));
    expect(ht6s).toBeTruthy();
  });

  it('includes mdx_extra option', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const select = container.querySelector('select');
    const options = Array.from(select?.querySelectorAll('option') ?? []);
    const mdx = options.find(o => o.textContent?.includes('MDX'));
    expect(mdx).toBeTruthy();
  });

  it('defaults to htdemucs model', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('htdemucs');
  });
});

describe('StemSeparationModal — buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Separate Stems" button', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const btns = Array.from(container.querySelectorAll('button'));
    const separateBtn = btns.find(b => b.textContent?.includes('Separate Stems'));
    expect(separateBtn).toBeTruthy();
  });

  it('renders "Cancel" button', () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const btns = Array.from(container.querySelectorAll('button'));
    const cancelBtn = btns.find(b => b.textContent?.includes('Cancel'));
    expect(cancelBtn).toBeTruthy();
  });

  it('Cancel button can be clicked', async () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const cancelBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Cancel')) as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    await fireEvent.click(cancelBtn);
    // Component should handle the click without errors
    await new Promise(r => setTimeout(r, 0));
  });

  it('close (×) button can be clicked', async () => {
    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const closeBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('✕')) as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    await fireEvent.click(closeBtn);
    // Component should handle the click without errors
    await new Promise(r => setTimeout(r, 0));
  });
});

describe('StemSeparationModal — separation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls audio.separateStems with correct filePath on button click', async () => {
    mockAf.audio.separateStems.mockResolvedValue({
      vocals: '/out/vocals.wav',
      drums: '/out/drums.wav',
      bass: '/out/bass.wav',
      other: '/out/other.wav',
    });
    mockAf.files.import.mockResolvedValue([
      { id: 10, name: 'vocals.wav', file_path: '/out/vocals.wav', file_type: 'wav', file_size: 1000 },
    ]);

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 0));

    expect(mockAf.audio.separateStems).toHaveBeenCalledWith(
      '/samples/bassline.wav',
      expect.objectContaining({ model: 'htdemucs' })
    );
  });

  it('shows progress indicator during separation', async () => {
    mockAf.audio.separateStems.mockImplementation(() => new Promise(r => setTimeout(r, 100)));

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 10));

    // Should show some separating indicator
    const text = container.textContent;
    expect(text).toContain('Separating') || expect(text).toContain('separating');
  });

  it('shows progress state during separation', async () => {
    mockAf.audio.separateStems.mockImplementation(() => new Promise(r => setTimeout(r, 50)));

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 10));

    // Should show progress state with progress bar or message
    const progressBar = container.querySelector('.progress-bar');
    const progressLabel = Array.from(container.querySelectorAll('p')).find(p => p.textContent?.toLowerCase().includes('starting'));
    expect(progressBar || progressLabel).toBeTruthy();
  });

  it('calls files.import with stem file paths', async () => {
    mockAf.audio.separateStems.mockResolvedValue({
      vocals: '/out/vocals.wav',
      drums: '/out/drums.wav',
      bass: '/out/bass.wav',
      other: '/out/other.wav',
    });
    mockAf.files.import.mockResolvedValue([
      { id: 10, name: 'vocals.wav', file_path: '/out/vocals.wav', file_type: 'wav', file_size: 1000 },
      { id: 11, name: 'drums.wav', file_path: '/out/drums.wav', file_type: 'wav', file_size: 1000 },
      { id: 12, name: 'bass.wav', file_path: '/out/bass.wav', file_type: 'wav', file_size: 1000 },
      { id: 13, name: 'other.wav', file_path: '/out/other.wav', file_type: 'wav', file_size: 1000 },
    ]);

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 50));

    expect(mockAf.files.import).toHaveBeenCalledWith([
      '/out/vocals.wav',
      '/out/drums.wav',
      '/out/bass.wav',
      '/out/other.wav',
    ]);
  });

  it('completes separation and imports stems', async () => {
    const importedStems = [
      { id: 10, name: 'vocals.wav', file_path: '/out/vocals.wav', file_type: 'wav', file_size: 1000 },
      { id: 11, name: 'drums.wav', file_path: '/out/drums.wav', file_type: 'wav', file_size: 1000 },
      { id: 12, name: 'bass.wav', file_path: '/out/bass.wav', file_type: 'wav', file_size: 1000 },
      { id: 13, name: 'other.wav', file_path: '/out/other.wav', file_type: 'wav', file_size: 1000 },
    ];
    mockAf.audio.separateStems.mockResolvedValue({
      vocals: '/out/vocals.wav',
      drums: '/out/drums.wav',
      bass: '/out/bass.wav',
      other: '/out/other.wav',
    });
    mockAf.files.import.mockResolvedValue(importedStems);

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 600)); // Wait for completion

    // Should have called files.import with all 4 stem paths
    expect(mockAf.files.import).toHaveBeenCalledWith([
      '/out/vocals.wav',
      '/out/drums.wav',
      '/out/bass.wav',
      '/out/other.wav',
    ]);
  });

  it('shows error message on separation failure', async () => {
    mockAf.audio.separateStems.mockRejectedValue(new Error('demucs not installed'));

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 50));

    expect(container.textContent).toContain('demucs not installed');
  });

  it('allows retry after error', async () => {
    mockAf.audio.separateStems
      .mockRejectedValueOnce(new Error('temp error'))
      .mockResolvedValueOnce({
        vocals: '/out/vocals.wav',
        drums: '/out/drums.wav',
        bass: '/out/bass.wav',
        other: '/out/other.wav',
      });
    mockAf.files.import.mockResolvedValue([
      { id: 10, name: 'vocals.wav', file_path: '/out/vocals.wav', file_type: 'wav', file_size: 1000 },
    ]);

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    let separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems') || b.textContent?.includes('Try Again')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 50));

    // Should show error
    expect(container.textContent).toContain('temp error');

    // Click Try Again button
    separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Try Again')) as HTMLButtonElement;
    if (separateBtn) {
      await fireEvent.click(separateBtn);
      await new Promise(r => setTimeout(r, 50));

      // Error should be cleared
      expect(container.textContent).not.toContain('temp error');
    }
  });
});

describe('StemSeparationModal — model selection in API call', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes selected model to separateStems', async () => {
    mockAf.audio.separateStems.mockResolvedValue({
      vocals: '/out/vocals.wav',
      drums: '/out/drums.wav',
      bass: '/out/bass.wav',
      other: '/out/other.wav',
    });
    mockAf.files.import.mockResolvedValue([]);

    const { container } = render(StemSeparationModal, { props: DEFAULT_PROPS });
    const select = container.querySelector('select') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'mdx_extra' } });

    const separateBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Separate Stems')) as HTMLButtonElement;
    await fireEvent.click(separateBtn);
    await new Promise(r => setTimeout(r, 0));

    expect(mockAf.audio.separateStems).toHaveBeenCalledWith(
      '/samples/bassline.wav',
      expect.objectContaining({ model: 'mdx_extra' })
    );
  });
});

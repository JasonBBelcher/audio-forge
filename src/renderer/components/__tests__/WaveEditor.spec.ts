// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WaveEditor from '../WaveEditor.svelte';

// Mock WaveSurfer
const mockWaveSurfer = {
  create: vi.fn(),
  load: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
  un: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 0),
  setTime: vi.fn(),
  registerPlugin: vi.fn(() => ({
    add: vi.fn(),
    getRegions: vi.fn(() => []),
  })),
};

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => mockWaveSurfer),
  },
}));

vi.mock('wavesurfer.js/dist/plugins/regions.js', () => ({
  default: {
    create: vi.fn(() => ({
      add: vi.fn(),
      getRegions: vi.fn(() => []),
    })),
  },
}));

// Mock window.audioforge
const mockAudioforge = {
  files: {
    showOpenDialog: vi.fn(),
    readAsArrayBuffer: vi.fn(),
    getMediaDir: vi.fn(),
  },
  audio: {
    getDuration: vi.fn(),
    getMetadata: vi.fn(),
    fadeIn: vi.fn(),
    fadeOut: vi.fn(),
    reverse: vi.fn(),
    pitchShift: vi.fn(),
    timeStretch: vi.fn(),
    silenceRemove: vi.fn(),
    trim: vi.fn(),
    normalize: vi.fn(),
  },
};

describe('WaveEditor Component', () => {
  beforeEach(() => {
    (window as any).audioforge = mockAudioforge;
    vi.clearAllMocks();
    mockWaveSurfer.create.mockReturnValue(mockWaveSurfer);
    mockWaveSurfer.registerPlugin.mockReturnValue({
      add: vi.fn(),
      getRegions: vi.fn(() => []),
    });
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('UI Layout', () => {
    it('renders top bar with Open File button', () => {
      render(WaveEditor);
      const btn = screen.getByRole('button', { name: /open file/i });
      expect(btn).toBeTruthy();
    });

    it('renders Undo button in top bar', () => {
      render(WaveEditor);
      const btn = screen.getByRole('button', { name: /undo/i });
      expect(btn).toBeTruthy();
    });

    it('renders Redo button in top bar', () => {
      render(WaveEditor);
      const btn = screen.getByRole('button', { name: /redo/i });
      expect(btn).toBeTruthy();
    });

    it('renders waveform container', () => {
      const { container } = render(WaveEditor);
      const waveform = container.querySelector('.waveform-container');
      expect(waveform).toBeTruthy();
    });

    it('renders transport controls (Play and Stop buttons)', () => {
      render(WaveEditor);
      const playBtn = screen.getByRole('button', { name: /play/i });
      const stopBtn = screen.getByRole('button', { name: /stop/i });
      expect(playBtn).toBeTruthy();
      expect(stopBtn).toBeTruthy();
    });

    it('renders edit toolbar with all 8 operation buttons', () => {
      render(WaveEditor);
      expect(screen.getByRole('button', { name: /trim/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /normalize/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /fade in/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /fade out/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /reverse/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /pitch/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /time stretch/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /silence/i })).toBeTruthy();
    });

    it('renders metadata bar with BPM, key, duration, sample rate placeholders', () => {
      const { container } = render(WaveEditor);
      const metadata = container.querySelector('.metadata-bar');
      expect(metadata).toBeTruthy();
    });
  });

  describe('File Operations', () => {
    it('Open File button calls showOpenDialog with audio filters', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/path/to/audio.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(45);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
        channels: 2,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));

      render(WaveEditor);
      const btn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(btn);

      expect(mockAudioforge.files.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({
              name: expect.stringContaining('Audio'),
            }),
          ]),
        })
      );
    });

    it('displays filename in top bar after file is loaded', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));

      const { container } = render(WaveEditor);
      const btn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(btn);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const filename = container.querySelector('.filename');
      expect(filename?.textContent).toContain('test.wav');
    });

    it('loads file into WaveSurfer when file is selected', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(45);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));

      render(WaveEditor);
      const btn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(btn);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockWaveSurfer.load).toHaveBeenCalled();
    });
  });

  describe('Undo/Redo', () => {
    it('Undo button is disabled when no edit history', () => {
      render(WaveEditor);
      const undoBtn = screen.getByRole('button', { name: /undo/i });
      expect(undoBtn.hasAttribute('disabled')).toBe(true);
    });

    it('Redo button is disabled when no redo history', () => {
      render(WaveEditor);
      const redoBtn = screen.getByRole('button', { name: /redo/i });
      expect(redoBtn.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Edit Operations', () => {
    it('edit buttons are disabled when no file is loaded', () => {
      render(WaveEditor);
      const normalizeBtn = screen.getByRole('button', { name: /normalize/i });
      const reverseBtn = screen.getByRole('button', { name: /reverse/i });
      expect(normalizeBtn.hasAttribute('disabled')).toBe(true);
      expect(reverseBtn.hasAttribute('disabled')).toBe(true);
    });

    it('clicking Normalize calls audio.normalize with current filePath', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));
      mockAudioforge.audio.normalize.mockResolvedValue('/media/test_normalized.wav');

      render(WaveEditor);
      const openBtn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(openBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      const normalizeBtn = screen.getByRole('button', { name: /normalize/i });
      await fireEvent.click(normalizeBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAudioforge.audio.normalize).toHaveBeenCalledWith(
        '/media/test.wav',
        expect.any(String)
      );
    });

    it('clicking Reverse calls audio.reverse with current filePath', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));
      mockAudioforge.audio.reverse.mockResolvedValue('/media/test_reversed.wav');

      render(WaveEditor);
      const openBtn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(openBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      const reverseBtn = screen.getByRole('button', { name: /reverse/i });
      await fireEvent.click(reverseBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAudioforge.audio.reverse).toHaveBeenCalledWith(
        '/media/test.wav',
        expect.any(String)
      );
    });

    it('clicking Silence Remove calls audio.silenceRemove with current filePath', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));
      mockAudioforge.audio.silenceRemove.mockResolvedValue('/media/test_no_silence.wav');

      render(WaveEditor);
      const openBtn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(openBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      const silenceBtn = screen.getByRole('button', { name: /silence/i });
      await fireEvent.click(silenceBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAudioforge.audio.silenceRemove).toHaveBeenCalledWith(
        '/media/test.wav',
        expect.any(String)
      );
    });

    it('Fade In shows parameter input when clicked', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));

      const { container } = render(WaveEditor);
      const openBtn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(openBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      const fadeInBtn = screen.getByRole('button', { name: /fade in/i });
      await fireEvent.click(fadeInBtn);

      await new Promise(resolve => setTimeout(resolve, 50));

      const paramInput = container.querySelector('.fade-in-param');
      expect(paramInput).toBeTruthy();
    });
  });

  describe('Processing State', () => {
    it('processing state shows "Applying..." label during edit operation', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));
      mockAudioforge.audio.normalize.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('/media/test_norm.wav'), 200))
      );

      const { container } = render(WaveEditor);
      const openBtn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(openBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      const normalizeBtn = screen.getByRole('button', { name: /normalize/i });
      await fireEvent.click(normalizeBtn);

      const label = container.querySelector('.processing-label');
      expect(label).toBeTruthy();
    });

    it('edit buttons are disabled during processing', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        sampleRate: 44100,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));
      mockAudioforge.audio.normalize.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('/media/test_norm.wav'), 200))
      );

      render(WaveEditor);
      const openBtn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(openBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      const normalizeBtn = screen.getByRole('button', { name: /normalize/i });
      await fireEvent.click(normalizeBtn);

      // Button should be disabled during processing
      expect(normalizeBtn.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Metadata', () => {
    it('metadata bar shows BPM, key, sample rate when file loaded', async () => {
      mockAudioforge.files.showOpenDialog.mockResolvedValue({
        filePaths: ['/media/test.wav'],
      });
      mockAudioforge.audio.getDuration.mockResolvedValue(30);
      mockAudioforge.audio.getMetadata.mockResolvedValue({
        bpm: 120,
        key: 'Am',
        sampleRate: 44100,
        channels: 2,
      });
      mockAudioforge.files.readAsArrayBuffer.mockResolvedValue(new ArrayBuffer(100));

      const { container } = render(WaveEditor);
      const openBtn = screen.getByRole('button', { name: /open file/i });
      await fireEvent.click(openBtn);

      await new Promise(resolve => setTimeout(resolve, 100));

      const metadata = container.querySelector('.metadata-bar');
      expect(metadata?.textContent).toContain('120');
      expect(metadata?.textContent).toContain('Am');
      expect(metadata?.textContent).toContain('44100');
    });
  });

  describe('Time Display', () => {
    it('renders current time and duration display', () => {
      const { container } = render(WaveEditor);
      const timeDisplay = container.querySelector('.time-display');
      expect(timeDisplay).toBeTruthy();
    });
  });
});

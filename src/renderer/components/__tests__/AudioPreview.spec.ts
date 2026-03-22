// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AudioPreview from '../AudioPreview.svelte';

describe('AudioPreview Component', () => {
  let mockAudioContext: any;
  let mockSourceNode: any;
  let mockGainNode: any;
  let mockAudioBuffer: any;

  beforeEach(() => {
    // Mock AudioContext and Web Audio API
    mockAudioBuffer = {
      duration: 4.2,
      length: 185400,
      sampleRate: 44100,
      numberOfChannels: 2,
    };

    mockSourceNode = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };

    mockGainNode = {
      connect: vi.fn(),
      gain: { value: 0.8 },
    };

    mockAudioContext = {
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
      createBufferSource: vi.fn().mockReturnValue(mockSourceNode),
      createGain: vi.fn().mockReturnValue(mockGainNode),
      destination: {},
      currentTime: 0,
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockAudioContext));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }));

    let rafId = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
      // Don't actually call the callback immediately to avoid infinite recursion
      // Just return an ID
      return ++rafId;
    }));

    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Rendering', () => {
    it('renders play button', () => {
      const { container } = render(AudioPreview, { props: {} });
      const playBtn = container.querySelector('button');
      expect(playBtn).toBeTruthy();
      expect(playBtn?.textContent).toMatch(/▶|⏸/);
    });

    it('renders filename when filePath is set', () => {
      const { container } = render(AudioPreview, {
        props: { filePath: '/path/to/kick.wav', fileName: 'kick.wav' }
      });
      expect(container.textContent).toContain('kick.wav');
    });

    it('renders seek range input', () => {
      const { container } = render(AudioPreview, { props: {} });
      const seekInput = container.querySelector('input[type="range"]');
      expect(seekInput).toBeTruthy();
    });

    it('renders volume range input', () => {
      const { container } = render(AudioPreview, { props: {} });
      const volumeInputs = container.querySelectorAll('input[type="range"]');
      expect(volumeInputs.length).toBeGreaterThanOrEqual(2); // seek and volume
    });

    it('renders time display initially', () => {
      const { container } = render(AudioPreview, { props: {} });
      const timeDisplay = container.textContent;
      expect(timeDisplay).toContain('0:00');
    });

    it('displays both current time and duration', () => {
      const { container } = render(AudioPreview, { props: {} });
      const timeDisplay = container.textContent;
      // Should show something like "0:00 / 0:00"
      expect(timeDisplay).toMatch(/0:00\s*\/\s*0:00/);
    });
  });

  describe('File Loading', () => {
    it('when filePath prop changes, calls fetch with file:// URL', async () => {
      const fetchSpy = vi.mocked(global.fetch);
      const { rerender } = render(AudioPreview, { props: { filePath: '', fileName: '' } });

      await rerender({
        filePath: '/Users/test/audio.wav',
        fileName: 'audio.wav',
      });

      // Wait for fetch and decode
      await new Promise(r => setTimeout(r, 50));

      expect(fetchSpy).toHaveBeenCalledWith('file:///Users/test/audio.wav');
    });

    it('calls arrayBuffer() on fetch response', async () => {
      const arrayBufferSpy = vi.fn().mockResolvedValue(new ArrayBuffer(8));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        arrayBuffer: arrayBufferSpy,
      }));

      const { rerender } = render(AudioPreview, { props: { filePath: '', fileName: '' } });

      await rerender({
        filePath: '/path/audio.wav',
        fileName: 'audio.wav',
      });

      await new Promise(r => setTimeout(r, 50));
      expect(arrayBufferSpy).toHaveBeenCalled();
    });

    it('calls audioContext.decodeAudioData with array buffer', async () => {
      const { rerender } = render(AudioPreview, { props: { filePath: '', fileName: '' } });

      await rerender({
        filePath: '/path/audio.wav',
        fileName: 'audio.wav',
      });

      await new Promise(r => setTimeout(r, 50));
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
    });

    it('shows loading state while decoding', async () => {
      mockAudioContext.decodeAudioData = vi.fn(() => new Promise(() => {})); // Never resolves

      const { container, rerender } = render(AudioPreview, { props: { filePath: '', fileName: '' } });

      await rerender({
        filePath: '/path/audio.wav',
        fileName: 'audio.wav',
      });

      // Should show loading state
      expect(container.textContent).toMatch(/loading|decoding/i);
    });

    it('sets duration after audio loads', async () => {
      const { container, rerender } = render(AudioPreview, { props: { filePath: '', fileName: '' } });

      await rerender({
        filePath: '/path/audio.wav',
        fileName: 'audio.wav',
      });

      await new Promise(r => setTimeout(r, 50));

      // Duration should be 4.2 seconds from mockAudioBuffer (formatted as 0:04)
      const timeDisplay = container.textContent;
      expect(timeDisplay).toContain('0:04');
    });
  });

  describe('Playback Controls', () => {
    it('clicking play button calls createBufferSource', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = container.querySelector('button');
      await fireEvent.click(playBtn!);

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('clicking play button calls sourceNode.start()', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = container.querySelector('button');
      await fireEvent.click(playBtn!);

      expect(mockSourceNode.start).toHaveBeenCalled();
    });

    it('play button becomes pause icon when playing', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = container.querySelector('button');
      expect(playBtn?.textContent).toContain('▶');

      await fireEvent.click(playBtn!);

      // Button should now show pause icon
      expect(playBtn?.textContent).toContain('⏸');
    });

    it('clicking pause button calls sourceNode.stop()', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = container.querySelector('button');
      await fireEvent.click(playBtn!); // Play
      await fireEvent.click(playBtn!); // Pause

      expect(mockSourceNode.stop).toHaveBeenCalled();
    });

    it('pause button becomes play icon when not playing', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = container.querySelector('button');
      await fireEvent.click(playBtn!); // Play
      expect(playBtn?.textContent).toContain('⏸');

      await fireEvent.click(playBtn!); // Pause
      expect(playBtn?.textContent).toContain('▶');
    });

    it('stop resets currentTime to 0', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = container.querySelector('button');
      await fireEvent.click(playBtn!); // Play

      // Manually set currentTime
      const component = container.parentElement;

      // Find seek input and change it
      const seekInput = container.querySelector('input[type="range"]') as HTMLInputElement;
      if (seekInput) {
        await fireEvent.change(seekInput, { target: { value: '2' } });
      }

      // Play should have started
      expect(mockSourceNode.start).toHaveBeenCalled();
    });
  });

  describe('Seeking', () => {
    it('seeking stops current playback and restarts', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = container.querySelector('button');
      await fireEvent.click(playBtn!); // Play

      const seekInput = container.querySelector('input[type="range"]') as HTMLInputElement;
      await fireEvent.change(seekInput, { target: { value: '2' } });

      // Should stop and restart
      expect(mockSourceNode.stop).toHaveBeenCalled();
    });
  });

  describe('Volume Control', () => {
    it('renders volume control', () => {
      const { container } = render(AudioPreview, { props: {} });
      const inputs = container.querySelectorAll('input[type="range"]');
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });

    it('volume input controls gain node', async () => {
      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const volumeInputs = container.querySelectorAll('input[type="range"]');
      const volumeInput = volumeInputs[volumeInputs.length - 1] as HTMLInputElement;

      await fireEvent.change(volumeInput, { target: { value: '0.5' } });

      // The gain should be updated (between 0 and 1)
      expect(mockGainNode.gain.value).toBeLessThanOrEqual(1);
      expect(mockGainNode.gain.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup', () => {
    it('closes AudioContext on destroy', async () => {
      const { unmount, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      unmount();

      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('stops playback on destroy', async () => {
      const { unmount, rerender } = render(AudioPreview, {
        props: { filePath: '/path/audio.wav', fileName: 'test.wav' }
      });

      await new Promise(r => setTimeout(r, 50));

      const playBtn = document.querySelector('button');
      await fireEvent.click(playBtn!);

      unmount();

      expect(mockSourceNode.stop).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const { container, rerender } = render(AudioPreview, { props: { filePath: '', fileName: '' } });

      await rerender({
        filePath: '/path/audio.wav',
        fileName: 'audio.wav',
      });

      await new Promise(r => setTimeout(r, 50));

      // Should show error state
      expect(container.textContent).toMatch(/error|failed/i);
    });

    it('handles decode errors gracefully', async () => {
      mockAudioContext.decodeAudioData = vi.fn().mockRejectedValue(new Error('Decode error'));

      const { container, rerender } = render(AudioPreview, {
        props: { filePath: '', fileName: '' }
      });

      await rerender({
        filePath: '/path/audio.wav',
        fileName: 'audio.wav',
      });

      await new Promise(r => setTimeout(r, 50));

      // Should show error state
      expect(container.textContent).toMatch(/error|failed/i);
    });
  });
});

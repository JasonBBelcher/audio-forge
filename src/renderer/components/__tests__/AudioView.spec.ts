// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AudioView from '../AudioView.svelte';

describe('AudioView Component', () => {
  beforeEach(() => {
    // Reset mock before each test
    (window as any).audioforge = undefined;
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(AudioView);
      expect(container).toBeTruthy();
    });

    it('shows "Audio Settings" heading', () => {
      const { getByText } = render(AudioView);
      expect(getByText(/Audio Settings/i)).toBeTruthy();
    });

    it('works without audioforge API', () => {
      // No mock needed - should still render with defaults
      const { container } = render(AudioView);
      expect(container.textContent).toContain('Audio Settings');
    });

    it('shows loading state while settings load', async () => {
      let resolveSettings: any;
      const settingsPromise = new Promise(r => {
        resolveSettings = r;
      });

      (window as any).audioforge = {
        settings: {
          getAll: () => settingsPromise,
        },
      };

      const { container } = render(AudioView);

      // Should show loading while promise pending
      await new Promise(r => setTimeout(r, 0));
      const loadingText = container.textContent;
      expect(loadingText).toContain('Loading') || expect(container.querySelector('.loading')).toBeTruthy();

      // Resolve promise
      resolveSettings({
        audioSampleRate: 48000,
        audioBufferSize: 512,
      });

      await new Promise(r => setTimeout(r, 0));
      expect(container.textContent).toContain('48000');
    });
  });

  describe('Settings Display', () => {
    it('shows current sample rate from settings', async () => {
      (window as any).audioforge = {
        settings: {
          getAll: () =>
            Promise.resolve({
              audioSampleRate: 48000,
              audioBufferSize: 256,
            }),
        },
      };

      const { container } = render(AudioView);
      await new Promise(r => setTimeout(r, 0));
      expect(container.textContent).toContain('48000');
    });

    it('shows current buffer size from settings', async () => {
      (window as any).audioforge = {
        settings: {
          getAll: () =>
            Promise.resolve({
              audioSampleRate: 44100,
              audioBufferSize: 512,
            }),
        },
      };

      const { container } = render(AudioView);
      await new Promise(r => setTimeout(r, 0));
      expect(container.textContent).toContain('512');
    });

    it('shows default sample rate when API unavailable', () => {
      const { container } = render(AudioView);
      expect(container.textContent).toContain('44100');
    });

    it('shows default buffer size when API unavailable', () => {
      const { container } = render(AudioView);
      expect(container.textContent).toContain('256');
    });
  });

  describe('Sample Rate Dropdown', () => {
    it('has a sample rate dropdown', () => {
      const { container } = render(AudioView);
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    it('has sample rate options: 44100, 48000, 88200, 96000', () => {
      const { container } = render(AudioView);
      const selects = Array.from(container.querySelectorAll('select'));
      const sampleRateSelect = selects[0]; // First select is sample rate

      const options = Array.from(sampleRateSelect.querySelectorAll('option')).map(o => o.value);
      expect(options).toContain('44100');
      expect(options).toContain('48000');
      expect(options).toContain('88200');
      expect(options).toContain('96000');
    });

    it('calls audioforge.settings.set when sample rate changes', async () => {
      const setSpy = vi.fn();
      (window as any).audioforge = {
        settings: {
          getAll: () =>
            Promise.resolve({
              audioSampleRate: 44100,
              audioBufferSize: 256,
            }),
          set: setSpy,
        },
      };

      const { container } = render(AudioView);
      await new Promise(r => setTimeout(r, 0));

      const selects = Array.from(container.querySelectorAll('select'));
      const sampleRateSelect = selects[0];

      await fireEvent.change(sampleRateSelect, { target: { value: '48000' } });
      expect(setSpy).toHaveBeenCalledWith('audioSampleRate', '48000');
    });
  });

  describe('Buffer Size Dropdown', () => {
    it('has a buffer size dropdown', () => {
      const { container } = render(AudioView);
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    it('has buffer size options: 128, 256, 512, 1024', () => {
      const { container } = render(AudioView);
      const selects = Array.from(container.querySelectorAll('select'));
      const bufferSizeSelect = selects[1]; // Second select is buffer size

      const options = Array.from(bufferSizeSelect.querySelectorAll('option')).map(o => o.value);
      expect(options).toContain('128');
      expect(options).toContain('256');
      expect(options).toContain('512');
      expect(options).toContain('1024');
    });

    it('calls audioforge.settings.set when buffer size changes', async () => {
      const setSpy = vi.fn();
      (window as any).audioforge = {
        settings: {
          getAll: () =>
            Promise.resolve({
              audioSampleRate: 44100,
              audioBufferSize: 256,
            }),
          set: setSpy,
        },
      };

      const { container } = render(AudioView);
      await new Promise(r => setTimeout(r, 0));

      const selects = Array.from(container.querySelectorAll('select'));
      const bufferSizeSelect = selects[1];

      await fireEvent.change(bufferSizeSelect, { target: { value: '512' } });
      expect(setSpy).toHaveBeenCalledWith('audioBufferSize', '512');
    });
  });
});

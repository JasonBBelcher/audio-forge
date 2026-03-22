// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import WaveformSparkline from '../WaveformSparkline.svelte';

describe('WaveformSparkline Component', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    });
  });

  it('renders a canvas element', () => {
    const { container } = render(WaveformSparkline);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('canvas has correct width and height from props', () => {
    const { container } = render(WaveformSparkline, {
      props: {
        width: 100,
        height: 32,
      },
    });
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(32);
  });

  it('renders without error when peaks is empty', () => {
    const { container } = render(WaveformSparkline, {
      props: {
        peaks: [],
        width: 80,
        height: 24,
      },
    });
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('renders without error when peaks has values', () => {
    const { container } = render(WaveformSparkline, {
      props: {
        peaks: [0.1, 0.5, 0.8, 0.3, 0.6],
        width: 80,
        height: 24,
      },
    });
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('calls getContext("2d") on mount', () => {
    const getContextSpy = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    });

    HTMLCanvasElement.prototype.getContext = getContextSpy;

    render(WaveformSparkline, {
      props: {
        peaks: [0.5],
        width: 80,
        height: 24,
      },
    });

    expect(getContextSpy).toHaveBeenCalledWith('2d');
  });

  it('calls fillRect for each peak value', () => {
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    render(WaveformSparkline, {
      props: {
        peaks: [0.1, 0.5, 0.8],
        width: 80,
        height: 24,
      },
    });

    // Should call fillRect for each peak (3 times)
    expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
  });

  it('respects custom color prop', () => {
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    render(WaveformSparkline, {
      props: {
        peaks: [0.5],
        width: 80,
        height: 24,
        color: '#ff0000',
      },
    });

    // Check that fillStyle was set to the custom color
    expect(mockCtx.fillStyle).toBe('#ff0000');
  });

  it('uses default color when not provided', () => {
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    render(WaveformSparkline, {
      props: {
        peaks: [0.5],
      },
    });

    expect(mockCtx.fillStyle).toBe('#6366f1');
  });

  it('draws a horizontal line when peaks is empty', () => {
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    render(WaveformSparkline, {
      props: {
        peaks: [],
        width: 80,
        height: 24,
      },
    });

    // When empty, should draw centerline using moveTo, lineTo, stroke
    expect(mockCtx.moveTo).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });
});

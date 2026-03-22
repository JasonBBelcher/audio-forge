import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StableAudioAdapter } from '../adapters/stable-audio.adapter.js';
import { spawn } from 'child_process';

// Mock child_process spawn
vi.mock('child_process', () => {
  const actualChildProcess = vi.importActual('child_process');
  return {
    ...actualChildProcess,
    spawn: vi.fn(),
  };
});

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

describe('StableAudioAdapter', () => {
  let adapter: StableAudioAdapter;

  beforeEach(() => {
    adapter = new StableAudioAdapter('/mock/scripts');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('properties', () => {
    it('should have correct id, name, and version', () => {
      expect(adapter.id).toBe('stable-audio-open');
      expect(adapter.name).toBe('Stable Audio Open');
      expect(adapter.version).toBe('1.0.0');
    });

    it('should have text-to-audio capability', () => {
      expect(adapter.capabilities).toHaveLength(1);
      expect(adapter.capabilities[0].type).toBe('text-to-audio');
    });
  });

  describe('isInstalled', () => {
    it('should spawn python with import check command', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await adapter.isInstalled();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('python'),
        ['-c', 'import stable_audio_tools'],
        expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
      );
    });

    it('should return true when python import succeeds', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      const result = await adapter.isInstalled();

      expect(result).toBe(true);
    });

    it('should return false when python import fails', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      const result = await adapter.isInstalled();

      expect(result).toBe(false);
    });
  });

  describe('generate', () => {
    it('should spawn generate_audio.py with correct arguments', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('Progress: 100% Done\nOUTPUT: /path/out.wav\n'), 10);
            }
          }),
        },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      const result = await adapter.generate({
        prompt: 'Ambient music',
        durationSec: 10,
        seed: 42,
        steps: 100,
        guidance: 7.0,
        outputPath: '/path/out.wav',
      });

      expect(mockSpawn).toHaveBeenCalled();
      const callArgs = (mockSpawn as any).mock.calls[0];
      const args = callArgs[1];

      expect(args).toContain('--prompt');
      expect(args).toContain('Ambient music');
      expect(args).toContain('--duration');
      expect(args).toContain('10');
      expect(args).toContain('--output');
      expect(args).toContain('/path/out.wav');
      expect(args).toContain('--seed');
      expect(args).toContain('42');
      expect(args).toContain('--steps');
      expect(args).toContain('100');
      expect(args).toContain('--guidance');
      expect(args).toContain('7');

      expect(result).toBe('/path/out.wav');
    });

    it('should handle parameters without seed, steps, guidance', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('OUTPUT: /path/out.wav\n'), 10);
            }
          }),
        },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      const result = await adapter.generate({
        prompt: 'Test audio',
        durationSec: 5,
        outputPath: '/path/out.wav',
      });

      expect(result).toBe('/path/out.wav');
      const callArgs = (mockSpawn as any).mock.calls[0];
      const args = callArgs[1];

      // seed, steps, guidance should not be in args
      const seedIndex = args.indexOf('--seed');
      const stepsIndex = args.indexOf('--steps');
      const guidanceIndex = args.indexOf('--guidance');

      expect(seedIndex).toBe(-1);
      expect(stepsIndex).toBe(-1);
      expect(guidanceIndex).toBe(-1);
    });

    it('should call onProgress callback when provided', async () => {
      const progressCallback = vi.fn();
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => {
                handler('Progress: 25%\n');
                handler('Progress: 50%\n');
                handler('Progress: 100% Done\n');
                handler('OUTPUT: /path/out.wav\n');
              }, 10);
            }
          }),
        },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await adapter.generate({
        prompt: 'Test',
        durationSec: 10,
        outputPath: '/path/out.wav',
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledWith(25);
      expect(progressCallback).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });

    it('should reject on non-zero exit code', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('Error: out of memory\n'), 10);
            }
          }),
        },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await expect(
        adapter.generate({
          prompt: 'Test',
          durationSec: 10,
          outputPath: '/path/out.wav',
        })
      ).rejects.toThrow();
    });

    it('should reject if no OUTPUT line found', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('Progress: 100%\n'), 10);
            }
          }),
        },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await expect(
        adapter.generate({
          prompt: 'Test',
          durationSec: 10,
          outputPath: '/path/out.wav',
        })
      ).rejects.toThrow();
    });
  });

  describe('install', () => {
    it('should spawn pip install with correct packages', async () => {
      const progressCallback = vi.fn();
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(
                () =>
                  handler(
                    'Collecting stable_audio_tools\n' +
                      'Installing collected packages: stable_audio_tools, torchaudio\n'
                  ),
                10
              );
            }
          }),
        },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await adapter.install(progressCallback);

      expect(mockSpawn).toHaveBeenCalled();
      const callArgs = (mockSpawn as any).mock.calls[0];
      const args = callArgs[1];

      expect(args).toContain('install');
      expect(args).toContain('stable_audio_tools');
      expect(args).toContain('torchaudio');
    });

    it('should call onProgress callback during install', async () => {
      const progressCallback = vi.fn();
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => {
                handler('Downloading stable_audio_tools\n');
                handler('Installing stable_audio_tools\n');
              }, 10);
            }
          }),
        },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await adapter.install(progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should reject on non-zero exit code', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('ERROR: Could not find version\n'), 10);
            }
          }),
        },
      };

      mockSpawn.mockReturnValue(mockProc);

      await expect(adapter.install()).rejects.toThrow();
    });
  });
});

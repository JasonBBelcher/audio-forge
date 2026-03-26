import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StableAudioAdapter } from '../adapters/stable-audio.adapter.js';
import { spawn } from 'child_process';
import { detectPlatform, torchInstallArgs } from '../../utils/platform-detector.js';

// Mock child_process spawn
vi.mock('child_process', () => {
  const actualChildProcess = vi.importActual('child_process');
  return {
    ...actualChildProcess,
    spawn: vi.fn(),
  };
});

// Mock platform-detector
vi.mock('../../utils/platform-detector.js', () => ({
  detectPlatform: vi.fn(() => ({
    os: 'darwin',
    arch: 'arm64',
    isAppleSilicon: true,
    hasNvidiaGpu: false,
    device: 'mps',
    summary: 'Apple Silicon (arm64)',
  })),
  torchInstallArgs: vi.fn(() => ['torch', 'torchaudio']),
  onnxPackage: vi.fn(() => 'onnxruntime'),
  basicPitchModelSerialization: vi.fn(() => 'onnx'),
}));

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
const mockDetectPlatform = detectPlatform as ReturnType<typeof vi.fn>;
const mockTorchInstallArgs = torchInstallArgs as ReturnType<typeof vi.fn>;

describe('StableAudioAdapter', () => {
  let adapter: StableAudioAdapter;

  beforeEach(() => {
    adapter = new StableAudioAdapter('/mock/scripts');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Adapter metadata', () => {
    it('should have correct id property', () => {
      expect(adapter.id).toBe('stable-audio-open');
    });

    it('should have a non-empty name', () => {
      expect(adapter.name).toBe('Stable Audio Open');
      expect(adapter.name.length).toBeGreaterThan(0);
    });

    it('should have a non-empty description in capabilities', () => {
      expect(adapter.capabilities).toHaveLength(1);
      expect(adapter.capabilities[0].type).toBe('text-to-audio');
      expect(adapter.capabilities[0].description).toBe('Text-to-audio generation');
      expect(adapter.capabilities[0].description.length).toBeGreaterThan(0);
    });

    it('should have a version property', () => {
      expect(adapter.version).toBe('1.0.0');
    });
  });

  describe('isInstalled()', () => {
    it('should call spawn with python binary', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.isInstalled();

      expect(mockSpawn).toHaveBeenCalled();
      const [pythonPath] = mockSpawn.mock.calls[0];
      expect(pythonPath).toContain('python');
    });

    it('should pass import check command including diffusers', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.isInstalled();

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('-c');
      const importCommand = args[args.indexOf('-c') + 1];
      expect(importCommand).toContain('diffusers');
    });

    it('should return true when spawn exits with code 0', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc);

      const result = await adapter.isInstalled();

      expect(result).toBe(true);
    });

    it('should return false when spawn exits with code 1', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc);

      const result = await adapter.isInstalled();

      expect(result).toBe(false);
    });
  });

  describe('install()', () => {
    it('should call spawn with pip binary', async () => {
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

      await adapter.install();

      expect(mockSpawn).toHaveBeenCalled();
      const [pipPath] = mockSpawn.mock.calls[0];
      expect(pipPath).toContain('pip');
    });

    it('should include diffusers in pip packages', async () => {
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

      await adapter.install();

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('diffusers');
    });

    it('should include transformers, accelerate, and soundfile packages', async () => {
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

      await adapter.install();

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('transformers');
      expect(args).toContain('accelerate');
      expect(args).toContain('soundfile');
    });

    it('should include torch packages from torchInstallArgs()', async () => {
      mockTorchInstallArgs.mockReturnValue(['torch', 'torchaudio']);
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

      await adapter.install();

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('torch');
      expect(args).toContain('torchaudio');
    });

    it('should reject when pip exits with non-zero code', async () => {
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
              setTimeout(() => handler('ERROR: Could not find version'), 10);
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(mockProc);

      await expect(adapter.install()).rejects.toThrow();
    });

    it('should call onProgress callback with status updates', async () => {
      const onProgress = vi.fn();
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
                handler('Downloading packages\n');
                handler('Installing collected packages\n');
              }, 10);
            }
          }),
        },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.install(onProgress);

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('uninstall()', () => {
    it('should call spawn with pip uninstall command', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.uninstall();

      expect(mockSpawn).toHaveBeenCalled();
      const [pipPath, args] = mockSpawn.mock.calls[0];
      expect(pipPath).toContain('pip');
      expect(args).toContain('uninstall');
    });

    it('should resolve when pip exits with code 0', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc);

      await expect(adapter.uninstall()).resolves.toBeUndefined();
    });

    it('should reject when pip exits with non-zero code', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc);

      await expect(adapter.uninstall()).rejects.toThrow();
    });
  });

  describe('generate(params)', () => {
    it('should call spawn with python binary', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('OUTPUT: /output.wav\n'), 10);
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.generate({
        prompt: 'test',
        durationSec: 10,
        outputPath: '/output.wav',
      });

      expect(mockSpawn).toHaveBeenCalled();
      const [pythonPath] = mockSpawn.mock.calls[0];
      expect(pythonPath).toContain('python');
    });

    it('should pass prompt in command arguments', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('OUTPUT: /output.wav\n'), 10);
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.generate({
        prompt: 'ambient music',
        durationSec: 10,
        outputPath: '/output.wav',
      });

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--prompt');
      expect(args).toContain('ambient music');
    });

    it('should pass outputPath configuration', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('OUTPUT: /my/output.wav\n'), 10);
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.generate({
        prompt: 'test',
        durationSec: 10,
        outputPath: '/my/output.wav',
      });

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--output');
      expect(args).toContain('/my/output.wav');
    });

    it('should return result with outputPath', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('OUTPUT: /final/path.wav\n'), 10);
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(mockProc);

      const result = await adapter.generate({
        prompt: 'test',
        durationSec: 10,
        outputPath: '/final/path.wav',
      });

      expect(result).toBe('/final/path.wav');
    });

    it('should reject when spawn exits with non-zero code', async () => {
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
      };
      mockSpawn.mockReturnValue(mockProc);

      await expect(
        adapter.generate({
          prompt: 'test',
          durationSec: 10,
          outputPath: '/output.wav',
        })
      ).rejects.toThrow();
    });

    it('should reject when no OUTPUT line is found', async () => {
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
      };
      mockSpawn.mockReturnValue(mockProc);

      await expect(
        adapter.generate({
          prompt: 'test',
          durationSec: 10,
          outputPath: '/output.wav',
        })
      ).rejects.toThrow();
    });

    it('should call onProgress callback during generation', async () => {
      const onProgress = vi.fn();
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
                handler('Progress: 75%\n');
                handler('OUTPUT: /output.wav\n');
              }, 10);
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.generate({
        prompt: 'test',
        durationSec: 10,
        outputPath: '/output.wav',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith(25);
      expect(onProgress).toHaveBeenCalledWith(75);
    });

    it('should pass all optional parameters when provided', async () => {
      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler('OUTPUT: /output.wav\n'), 10);
            }
          }),
        },
      };
      mockSpawn.mockReturnValue(mockProc);

      await adapter.generate({
        prompt: 'test',
        durationSec: 10,
        outputPath: '/output.wav',
        seed: 42,
        steps: 100,
        guidance: 7.5,
      });

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--seed');
      expect(args).toContain('42');
      expect(args).toContain('--steps');
      expect(args).toContain('100');
      expect(args).toContain('--guidance');
      expect(args).toContain('7.5');
    });
  });
});

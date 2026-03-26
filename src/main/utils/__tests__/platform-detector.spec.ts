import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PlatformInfo } from '../platform-detector';

// Mock child_process before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('platform-detector', () => {
  beforeEach(() => {
    // Reset modules to clear the module-level cache
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // detectPlatform() Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('detectPlatform()', () => {
    it('detects Apple Silicon (darwin + arm64)', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'arm64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      const info = detectPlatform();

      expect(info.os).toBe('darwin');
      expect(info.arch).toBe('arm64');
      expect(info.isAppleSilicon).toBe(true);
      expect(info.hasNvidiaGpu).toBe(false);
      expect(info.device).toBe('mps');
      expect(info.summary).toBe('Apple Silicon (arm64)');
    });

    it('detects macOS Intel (darwin + x64)', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      const info = detectPlatform();

      expect(info.os).toBe('darwin');
      expect(info.arch).toBe('x64');
      expect(info.isAppleSilicon).toBe(false);
      expect(info.hasNvidiaGpu).toBe(false);
      expect(info.device).toBe('cpu');
      expect(info.summary).toBe('macOS Intel (x64)');
    });

    it('does NOT call nvidia-smi on macOS', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);

      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'arm64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      detectPlatform();

      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('detects Linux + NVIDIA GPU when nvidia-smi succeeds', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue(Buffer.from('NVIDIA-SMI output'));

      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      const info = detectPlatform();

      expect(info.os).toBe('linux');
      expect(info.arch).toBe('x64');
      expect(info.isAppleSilicon).toBe(false);
      expect(info.hasNvidiaGpu).toBe(true);
      expect(info.device).toBe('cuda');
      expect(info.summary).toBe('Linux + NVIDIA GPU');
      expect(mockExecSync).toHaveBeenCalledWith('nvidia-smi', {
        stdio: 'pipe',
        timeout: 3000,
      });
    });

    it('detects Linux CPU-only when nvidia-smi throws', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error('nvidia-smi not found');
      });

      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      const info = detectPlatform();

      expect(info.os).toBe('linux');
      expect(info.arch).toBe('x64');
      expect(info.hasNvidiaGpu).toBe(false);
      expect(info.device).toBe('cpu');
      expect(info.summary).toBe('Linux CPU-only');
    });

    it('detects Windows + NVIDIA GPU when nvidia-smi succeeds', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue(Buffer.from('NVIDIA-SMI output'));

      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      const info = detectPlatform();

      expect(info.os).toBe('win32');
      expect(info.arch).toBe('x64');
      expect(info.hasNvidiaGpu).toBe(true);
      expect(info.device).toBe('cuda');
      expect(info.summary).toBe('Windows + NVIDIA GPU');
      expect(mockExecSync).toHaveBeenCalledWith('nvidia-smi', {
        stdio: 'pipe',
        timeout: 3000,
      });
    });

    it('detects Windows CPU-only when nvidia-smi throws', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error('nvidia-smi not found');
      });

      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      const info = detectPlatform();

      expect(info.os).toBe('win32');
      expect(info.arch).toBe('x64');
      expect(info.hasNvidiaGpu).toBe(false);
      expect(info.device).toBe('cpu');
      expect(info.summary).toBe('Windows CPU-only');
    });

    it('caches the result: calling twice returns same object reference', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        configurable: true,
      });

      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue(Buffer.from(''));

      const { detectPlatform } = await import('../platform-detector');

      const info1 = detectPlatform();
      const info2 = detectPlatform();

      // Should be the same object (cached)
      expect(info1).toBe(info2);
      // nvidia-smi should only be called once
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it('handles execSync timeout gracefully', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation(() => {
        const error = new Error('Command timed out');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      });

      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        configurable: true,
      });

      const { detectPlatform } = await import('../platform-detector');
      const info = detectPlatform();

      // Timeout is treated as "no GPU"
      expect(info.hasNvidiaGpu).toBe(false);
      expect(info.device).toBe('cpu');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // onnxPackage() Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('onnxPackage()', () => {
    it('returns onnxruntime-gpu for NVIDIA GPU', async () => {
      const { onnxPackage } = await import('../platform-detector');

      const info: PlatformInfo = {
        os: 'linux',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: true,
        device: 'cuda',
        summary: 'Linux + NVIDIA GPU',
      };

      expect(onnxPackage(info)).toBe('onnxruntime-gpu');
    });

    it('returns onnxruntime for non-NVIDIA platforms', async () => {
      const { onnxPackage } = await import('../platform-detector');

      const infoAppleSilicon: PlatformInfo = {
        os: 'darwin',
        arch: 'arm64',
        isAppleSilicon: true,
        hasNvidiaGpu: false,
        device: 'mps',
        summary: 'Apple Silicon (arm64)',
      };

      expect(onnxPackage(infoAppleSilicon)).toBe('onnxruntime');
    });

    it('returns onnxruntime for Linux CPU-only', async () => {
      const { onnxPackage } = await import('../platform-detector');

      const infoCpuOnly: PlatformInfo = {
        os: 'linux',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'Linux CPU-only',
      };

      expect(onnxPackage(infoCpuOnly)).toBe('onnxruntime');
    });

    it('returns onnxruntime for macOS Intel', async () => {
      const { onnxPackage } = await import('../platform-detector');

      const infoMacIntel: PlatformInfo = {
        os: 'darwin',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'macOS Intel (x64)',
      };

      expect(onnxPackage(infoMacIntel)).toBe('onnxruntime');
    });

    it('returns onnxruntime-gpu for Windows + NVIDIA', async () => {
      const { onnxPackage } = await import('../platform-detector');

      const infoWindowsNvidia: PlatformInfo = {
        os: 'win32',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: true,
        device: 'cuda',
        summary: 'Windows + NVIDIA GPU',
      };

      expect(onnxPackage(infoWindowsNvidia)).toBe('onnxruntime-gpu');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // torchInstallArgs() Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('torchInstallArgs()', () => {
    it('returns PyTorch CUDA 12.1 index for Linux + NVIDIA', async () => {
      const { torchInstallArgs } = await import('../platform-detector');

      const info: PlatformInfo = {
        os: 'linux',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: true,
        device: 'cuda',
        summary: 'Linux + NVIDIA GPU',
      };

      const args = torchInstallArgs(info);
      expect(args).toEqual([
        'torch',
        'torchaudio',
        '--index-url',
        'https://download.pytorch.org/whl/cu121',
      ]);
    });

    it('returns PyTorch CPU index for Linux CPU-only', async () => {
      const { torchInstallArgs } = await import('../platform-detector');

      const info: PlatformInfo = {
        os: 'linux',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'Linux CPU-only',
      };

      const args = torchInstallArgs(info);
      expect(args).toEqual([
        'torch',
        'torchaudio',
        '--index-url',
        'https://download.pytorch.org/whl/cpu',
      ]);
    });

    it('returns PyTorch CUDA 12.1 index for Windows + NVIDIA', async () => {
      const { torchInstallArgs } = await import('../platform-detector');

      const info: PlatformInfo = {
        os: 'win32',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: true,
        device: 'cuda',
        summary: 'Windows + NVIDIA GPU',
      };

      const args = torchInstallArgs(info);
      expect(args).toEqual([
        'torch',
        'torchaudio',
        '--index-url',
        'https://download.pytorch.org/whl/cu121',
      ]);
    });

    it('returns standard PyPI for macOS (Apple Silicon)', async () => {
      const { torchInstallArgs } = await import('../platform-detector');

      const infoAppleSilicon: PlatformInfo = {
        os: 'darwin',
        arch: 'arm64',
        isAppleSilicon: true,
        hasNvidiaGpu: false,
        device: 'mps',
        summary: 'Apple Silicon (arm64)',
      };

      const args = torchInstallArgs(infoAppleSilicon);
      expect(args).toEqual(['torch', 'torchaudio']);
    });

    it('returns standard PyPI for macOS Intel', async () => {
      const { torchInstallArgs } = await import('../platform-detector');

      const infoMacIntel: PlatformInfo = {
        os: 'darwin',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'macOS Intel (x64)',
      };

      const args = torchInstallArgs(infoMacIntel);
      expect(args).toEqual(['torch', 'torchaudio']);
    });

    it('returns standard PyPI for Windows CPU-only', async () => {
      const { torchInstallArgs } = await import('../platform-detector');

      const infoWindowsCpu: PlatformInfo = {
        os: 'win32',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'Windows CPU-only',
      };

      const args = torchInstallArgs(infoWindowsCpu);
      expect(args).toEqual(['torch', 'torchaudio']);
    });

    it('includes no index-url for standard PyPI installations', async () => {
      const { torchInstallArgs } = await import('../platform-detector');

      const infoMac: PlatformInfo = {
        os: 'darwin',
        arch: 'arm64',
        isAppleSilicon: true,
        hasNvidiaGpu: false,
        device: 'mps',
        summary: 'Apple Silicon (arm64)',
      };

      const args = torchInstallArgs(infoMac);
      expect(args).not.toContain('--index-url');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // basicPitchModelSerialization() Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('basicPitchModelSerialization()', () => {
    it('always returns onnx for Apple Silicon', async () => {
      const { basicPitchModelSerialization } = await import(
        '../platform-detector'
      );

      const info: PlatformInfo = {
        os: 'darwin',
        arch: 'arm64',
        isAppleSilicon: true,
        hasNvidiaGpu: false,
        device: 'mps',
        summary: 'Apple Silicon (arm64)',
      };

      expect(basicPitchModelSerialization(info)).toBe('onnx');
    });

    it('always returns onnx for macOS Intel', async () => {
      const { basicPitchModelSerialization } = await import(
        '../platform-detector'
      );

      const info: PlatformInfo = {
        os: 'darwin',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'macOS Intel (x64)',
      };

      expect(basicPitchModelSerialization(info)).toBe('onnx');
    });

    it('always returns onnx for Linux + NVIDIA', async () => {
      const { basicPitchModelSerialization } = await import(
        '../platform-detector'
      );

      const info: PlatformInfo = {
        os: 'linux',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: true,
        device: 'cuda',
        summary: 'Linux + NVIDIA GPU',
      };

      expect(basicPitchModelSerialization(info)).toBe('onnx');
    });

    it('always returns onnx for Linux CPU-only', async () => {
      const { basicPitchModelSerialization } = await import(
        '../platform-detector'
      );

      const info: PlatformInfo = {
        os: 'linux',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'Linux CPU-only',
      };

      expect(basicPitchModelSerialization(info)).toBe('onnx');
    });

    it('always returns onnx for Windows + NVIDIA', async () => {
      const { basicPitchModelSerialization } = await import(
        '../platform-detector'
      );

      const info: PlatformInfo = {
        os: 'win32',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: true,
        device: 'cuda',
        summary: 'Windows + NVIDIA GPU',
      };

      expect(basicPitchModelSerialization(info)).toBe('onnx');
    });

    it('always returns onnx for Windows CPU-only', async () => {
      const { basicPitchModelSerialization } = await import(
        '../platform-detector'
      );

      const info: PlatformInfo = {
        os: 'win32',
        arch: 'x64',
        isAppleSilicon: false,
        hasNvidiaGpu: false,
        device: 'cpu',
        summary: 'Windows CPU-only',
      };

      expect(basicPitchModelSerialization(info)).toBe('onnx');
    });
  });
});

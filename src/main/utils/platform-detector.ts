/**
 * Platform detection utility.
 *
 * Detects OS, architecture, and GPU capabilities so that services
 * can install the right packages and select the right inference backend
 * without hardcoding platform-specific values.
 */

import { execSync } from 'child_process';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeviceBackend = 'mps' | 'cuda' | 'cpu';

export interface PlatformInfo {
  /** Raw Node.js platform string */
  os: NodeJS.Platform;
  /** CPU architecture: 'arm64' | 'x64' etc. */
  arch: string;
  /** True on macOS + arm64 (M1/M2/M3) */
  isAppleSilicon: boolean;
  /** True when nvidia-smi is present and responds */
  hasNvidiaGpu: boolean;
  /** Best available inference device for ML workloads */
  device: DeviceBackend;
  /** Human-readable summary, e.g. "Apple Silicon (arm64)" */
  summary: string;
}

// ── Detection ─────────────────────────────────────────────────────────────────

let _cached: PlatformInfo | null = null;

export function detectPlatform(): PlatformInfo {
  if (_cached) return _cached;

  const os = process.platform;
  const arch = process.arch;
  const isAppleSilicon = os === 'darwin' && arch === 'arm64';

  let hasNvidiaGpu = false;
  if (os === 'linux' || os === 'win32') {
    try {
      execSync('nvidia-smi', { stdio: 'pipe', timeout: 3000 });
      hasNvidiaGpu = true;
    } catch {
      hasNvidiaGpu = false;
    }
  }

  let device: DeviceBackend = 'cpu';
  if (isAppleSilicon) device = 'mps';
  else if (hasNvidiaGpu) device = 'cuda';

  let summary = '';
  if (isAppleSilicon) summary = 'Apple Silicon (arm64)';
  else if (os === 'darwin') summary = 'macOS Intel (x64)';
  else if (os === 'linux' && hasNvidiaGpu) summary = 'Linux + NVIDIA GPU';
  else if (os === 'linux') summary = 'Linux CPU-only';
  else if (os === 'win32' && hasNvidiaGpu) summary = 'Windows + NVIDIA GPU';
  else if (os === 'win32') summary = 'Windows CPU-only';
  else summary = `${os} ${arch}`;

  _cached = { os, arch, isAppleSilicon, hasNvidiaGpu, device, summary };
  return _cached;
}

// ── Package helpers ───────────────────────────────────────────────────────────

/**
 * Returns the correct onnxruntime package name for this platform.
 * - NVIDIA GPU  → onnxruntime-gpu  (CUDA-accelerated)
 * - Everything else → onnxruntime  (Apple Silicon gets native ARM64 wheels)
 */
export function onnxPackage(info: PlatformInfo): string {
  return info.hasNvidiaGpu ? 'onnxruntime-gpu' : 'onnxruntime';
}

/**
 * Returns pip install args for PyTorch + torchaudio for this platform.
 *
 * - Apple Silicon / macOS Intel → standard PyPI (includes MPS support)
 * - Linux + NVIDIA GPU          → PyTorch CUDA 12.1 index
 * - Linux CPU-only              → PyTorch CPU-only index (smaller download)
 * - Windows + NVIDIA GPU        → PyTorch CUDA 12.1 index
 * - Windows CPU-only            → standard PyPI
 */
export function torchInstallArgs(info: PlatformInfo): string[] {
  if (info.os === 'linux' && info.hasNvidiaGpu) {
    return [
      'torch', 'torchaudio',
      '--index-url', 'https://download.pytorch.org/whl/cu121',
    ];
  }
  if (info.os === 'linux' && !info.hasNvidiaGpu) {
    return [
      'torch', 'torchaudio',
      '--index-url', 'https://download.pytorch.org/whl/cpu',
    ];
  }
  if (info.os === 'win32' && info.hasNvidiaGpu) {
    return [
      'torch', 'torchaudio',
      '--index-url', 'https://download.pytorch.org/whl/cu121',
    ];
  }
  // macOS (Apple Silicon or Intel) — standard PyPI ships MPS-capable wheels
  return ['torch', 'torchaudio'];
}

/**
 * Returns the --model-serialization flag value for basic-pitch.
 * ONNX is the universal choice — it has native ARM64 wheels on Apple Silicon,
 * GPU support on NVIDIA via onnxruntime-gpu, and avoids TF version conflicts.
 */
export function basicPitchModelSerialization(_info: PlatformInfo): string {
  return 'onnx';
}

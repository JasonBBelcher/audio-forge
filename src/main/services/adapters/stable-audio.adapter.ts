import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { runProcess } from '../../utils/process-runner.js';
import type { TextToAudioAdapter, ModelCapability } from '../model-adapter.js';
import { detectPlatform, torchInstallArgs, type PlatformInfo } from '../../utils/platform-detector.js';

/**
 * Strip tqdm progress bars, ANSI escape codes, and carriage-return lines from
 * Python stderr, then return the most relevant error lines (Error:/Traceback).
 */
function extractPythonError(raw: string): string {
  const cleaned = raw
    // Remove ANSI escape sequences (colors, cursor movement)
    .replace(/\x1b\[[0-9;]*[mGKAFBCDHJfSTu]/g, '')
    // Replace carriage returns so tqdm \r-overwritten lines collapse
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      // Drop tqdm progress bar lines: "Fetching 15 files:  7%|████  | 1/15 …"
      if (/\d+%\|/.test(t)) return false;
      if (/\[\d+:\d+<\d+:\d+/.test(t)) return false;
      // Drop HF hub "Downloading …" lines that aren't errors
      if (/^(Downloading|Fetching|Loading pipeline|Loading weights)\b/.test(t) && !t.includes('Error')) return false;
      return true;
    })
    .join('\n')
    .trim();

  if (!cleaned) return raw.slice(-300).trim();

  // Prefer the last "Error:" line + traceback if present
  const lines = cleaned.split('\n');
  const errorIdx = lines.findLastIndex((l) => /^(Error|.*Error:)\s/.test(l.trim()));
  if (errorIdx !== -1) {
    return lines.slice(errorIdx).join('\n').trim();
  }

  // Fall back to last 5 lines
  return lines.slice(-5).join('\n').trim();
}

export class StableAudioAdapter implements TextToAudioAdapter {
  readonly id = 'stable-audio-open';
  readonly name = 'Stable Audio Open';
  readonly version = '1.0.0';
  readonly capabilities: ModelCapability[] = [
    { type: 'text-to-audio', description: 'Text-to-audio generation' },
  ];

  private pythonVenv = join(homedir(), '.audioforge-venv', 'bin', 'python');
  private venvPip = join(homedir(), '.audioforge-venv', 'bin', 'pip');
  private scriptDir: string;
  private getHfToken: () => string | undefined;

  constructor(
    scriptDir: string = join(process.cwd(), 'scripts'),
    getHfToken: () => string | undefined = () => undefined,
  ) {
    this.scriptDir = scriptDir;
    this.getHfToken = getHfToken;
  }

  async isInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      // Check for diffusers (StableAudioPipeline) + soundfile which our script needs
      const proc = spawn(this.pythonVenv, ['-c', 'import diffusers, soundfile, torch; from diffusers import StableAudioPipeline'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });
    });
  }

  async install(onProgress?: (pct: number, msg: string) => void): Promise<void> {
    const venvDir = join(homedir(), '.audioforge-venv');

    // Create the venv from system Python if it doesn't exist yet
    if (!existsSync(join(venvDir, 'bin', 'python'))) {
      onProgress?.(5, 'creating Python environment');
      const pythonCandidates = ['python3.12', 'python3.11', 'python3.10', 'python3', 'python'];
      let created = false;
      for (const py of pythonCandidates) {
        const r = await runProcess(py, ['-m', 'venv', venvDir]);
        if (r.exitCode === 0) { created = true; break; }
      }
      if (!created) {
        throw new Error('Could not create Python virtual environment. Please install Python 3.10+.');
      }
    }

    onProgress?.(10, 'installing setuptools');
    // Ensure setuptools is present (needed by some build backends)
    await runProcess(this.venvPip, ['install', '--upgrade', 'setuptools', 'wheel']);

    onProgress?.(20, 'downloading packages');
    const platform = detectPlatform();
    const torchArgs = torchInstallArgs(platform);
    // diffusers stack + platform-appropriate torch build
    const packages = ['diffusers', 'transformers', 'accelerate', 'soundfile', 'torchsde', ...torchArgs];

    return new Promise((resolve, reject) => {
      const proc = spawn(this.venvPip, ['install', ...packages], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (onProgress) {
          if (stdout.includes('Downloading')) {
            onProgress(40, 'downloading');
          } else if (stdout.includes('Installing collected')) {
            onProgress(80, 'installing');
          } else if (stdout.includes('Requirement already satisfied')) {
            onProgress(50, 'already installed');
          }
        }
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          onProgress?.(100, 'complete');
          resolve();
        } else {
          reject(new Error(`pip install failed with code ${code}: ${stderr || stdout}`));
        }
      });
    });
  }

  async uninstall(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.venvPip, ['uninstall', '-y', 'stable_audio_tools', 'torchaudio'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pip uninstall failed with code ${code}`));
        }
      });
    });
  }

  async generate(params: {
    prompt: string;
    durationSec: number;
    seed?: number;
    steps?: number;
    guidance?: number;
    outputPath: string;
    onProgress?: (pct: number) => void;
  }): Promise<string> {
    // Upgrade diffusers + install torchsde. Older diffusers versions have an infinite
    // recursion bug in CosineDPMSolverMultistepScheduler. pip is fast (~1-2s) when
    // already up to date — it just checks the version and exits.
    await runProcess(this.venvPip, ['install', '--quiet', '--upgrade', 'diffusers', 'torchsde']).catch(() => {
      // Non-fatal: the generate attempt will surface any real error
    });

    return new Promise((resolve, reject) => {
      const scriptPath = join(this.scriptDir, 'generate_audio.py');

      // BrownianTreeNoiseSampler float-precision bug is patched in generate_audio.py,
      // so MPS is now safe. Use platform-detector to pick the best device.
      const platform: PlatformInfo = detectPlatform();
      const device = platform.device; // 'cuda' | 'mps' | 'cpu'

      const args = ['--prompt', params.prompt, '--duration', params.durationSec.toString(), '--output', params.outputPath, '--device', device];

      if (params.seed !== undefined) {
        args.push('--seed', params.seed.toString());
      }

      if (params.steps !== undefined) {
        args.push('--steps', params.steps.toString());
      }

      if (params.guidance !== undefined) {
        args.push('--guidance', params.guidance.toString());
      }

      const hfToken = this.getHfToken();
      const env: NodeJS.ProcessEnv = { ...process.env };
      if (hfToken) {
        env.HF_TOKEN = hfToken;
        env.HUGGING_FACE_HUB_TOKEN = hfToken;
      }
      // Suppress tqdm progress bars — they pollute stderr with ANSI junk
      env.TQDM_DISABLE = '1';
      env.HF_HUB_DISABLE_PROGRESS_BARS = '1';

      const proc = spawn(this.pythonVenv, [scriptPath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      });

      // 30-minute hard timeout — handles true hangs (e.g. network stall mid-download)
      const TIMEOUT_MS = 30 * 60 * 1000;
      const timeoutHandle = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(
          'Audio generation timed out after 30 minutes. ' +
          'The model download may have stalled — check your internet connection and try again.'
        ));
      }, TIMEOUT_MS);

      let stdout = '';
      let stderr = '';
      let outputPath: string | undefined;

      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // Parse progress lines
        const progressMatch = chunk.match(/Progress:\s*(\d+)%/);
        if (progressMatch && params.onProgress) {
          params.onProgress(parseInt(progressMatch[1]));
        }

        // Parse output line
        const outputMatch = chunk.match(/OUTPUT:\s*(.+)/);
        if (outputMatch) {
          outputPath = outputMatch[1].trim();
        }
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        if (code === 0) {
          if (!outputPath) {
            reject(new Error('No output path returned from generate_audio.py'));
          } else {
            resolve(outputPath);
          }
        } else {
          const detail = stderr || stdout;
          // Surface a friendly message for the common auth error
          if (detail.includes('401') || detail.includes('GatedRepoError') || detail.includes('restricted') || detail.includes('authentication')) {
            reject(new Error(
              'This model requires a HuggingFace account token. ' +
              'Go to Settings → AI Models, paste your token, then try again. ' +
              'You can get a free token at huggingface.co/settings/tokens'
            ));
          } else {
            reject(new Error(`generate_audio.py failed: ${extractPythonError(detail)}`));
          }
        }
      });
    });
  }
}

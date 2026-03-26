import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import type { TextToAudioAdapter, ModelCapability } from '../model-adapter.js';
import { detectPlatform, torchInstallArgs } from '../../utils/platform-detector.js';

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

  constructor(scriptDir: string = join(process.cwd(), 'scripts')) {
    this.scriptDir = scriptDir;
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
    const platform = detectPlatform();
    const torchArgs = torchInstallArgs(platform);
    // diffusers stack + platform-appropriate torch build
    const packages = ['diffusers', 'transformers', 'accelerate', 'soundfile', ...torchArgs];

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
            onProgress(25, 'downloading');
          } else if (stdout.includes('Installing collected')) {
            onProgress(75, 'installing');
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
          if (onProgress) {
            onProgress(100, 'complete');
          }
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
    return new Promise((resolve, reject) => {
      const scriptPath = join(this.scriptDir, 'generate_audio.py');

      const args = ['--prompt', params.prompt, '--duration', params.durationSec.toString(), '--output', params.outputPath];

      if (params.seed !== undefined) {
        args.push('--seed', params.seed.toString());
      }

      if (params.steps !== undefined) {
        args.push('--steps', params.steps.toString());
      }

      if (params.guidance !== undefined) {
        args.push('--guidance', params.guidance.toString());
      }

      const proc = spawn(this.pythonVenv, [scriptPath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let outputPath: string | undefined;

      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;

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

      proc.on('close', (code) => {
        if (code === 0) {
          if (!outputPath) {
            reject(new Error('No output path returned from generate_audio.py'));
          } else {
            resolve(outputPath);
          }
        } else {
          reject(new Error(`generate_audio.py failed with code ${code}: ${output}`));
        }
      });
    });
  }
}

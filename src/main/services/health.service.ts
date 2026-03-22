import os from 'os';
import { runProcess } from '../utils/process-runner.js';

export interface ToolStatus {
  available: boolean;
  version?: string;
  path?: string;
}

export interface HealthStatus {
  tools: Record<string, ToolStatus>;
  system: {
    platform: string;
    arch: string;
    memory: number;
  };
}

export interface InstallerEntry {
  command: string;
  args: string[];
}

export type PlatformInstallers = Partial<Record<'darwin' | 'linux' | 'win32', InstallerEntry>>;

/** Maps each optional CLI tool to its platform-specific install command. */
export const TOOL_INSTALLERS: Record<string, PlatformInstallers> = {
  ffmpeg: {
    darwin: { command: 'brew', args: ['install', 'ffmpeg'] },
    linux:  { command: 'apt-get', args: ['install', '-y', 'ffmpeg'] },
    win32:  { command: 'winget', args: ['install', 'Gyan.FFmpeg'] },
  },
  'yt-dlp': {
    darwin: { command: 'brew', args: ['install', 'yt-dlp'] },
    linux:  { command: 'pip3', args: ['install', 'yt-dlp'] },
    win32:  { command: 'pip3', args: ['install', 'yt-dlp'] },
  },
  sox: {
    darwin: { command: 'brew', args: ['install', 'sox'] },
    linux:  { command: 'apt-get', args: ['install', '-y', 'sox'] },
    win32:  { command: 'winget', args: ['install', 'sox.sox'] },
  },
  aubio: {
    darwin: { command: 'brew', args: ['install', 'aubio'] },
    linux:  { command: 'apt-get', args: ['install', '-y', 'aubio'] },
    win32:  { command: 'pip3', args: ['install', 'aubio'] },
  },
  demucs: {
    darwin: { command: 'pip3', args: ['install', 'demucs'] },
    linux:  { command: 'pip3', args: ['install', 'demucs'] },
    win32:  { command: 'pip3', args: ['install', 'demucs'] },
  },
};

const REQUIRED_TOOLS = ['ffmpeg', 'ffprobe', 'yt-dlp', 'sox', 'demucs', 'aubio'];

const VERSION_ARGS: Record<string, string[]> = {
  ffmpeg: ['-version'],
  ffprobe: ['-version'],
  'yt-dlp': ['--version'],
  sox: ['--version'],
  demucs: ['--version'],
  aubio: ['--version'],
  node: ['--version'],
};

const VERSION_REGEX = /(\d+\.\d+[\.\d]*)/;

export class HealthService {
  async checkTool(tool: string): Promise<ToolStatus> {
    const args = VERSION_ARGS[tool] ?? ['--version'];
    try {
      const result = await runProcess(tool, args, { timeout: 5000 });
      const output = result.stdout + result.stderr;
      const match = output.match(VERSION_REGEX);
      return {
        available: true,
        version: match ? match[1] : output.split('\n')[0].trim(),
      };
    } catch {
      return { available: false };
    }
  }

  async getStatus(): Promise<HealthStatus> {
    const toolEntries = await Promise.all(
      REQUIRED_TOOLS.map(async (tool) => [tool, await this.checkTool(tool)] as const)
    );

    return {
      tools: Object.fromEntries(toolEntries),
      system: {
        platform: process.platform,
        arch: process.arch,
        memory: os.totalmem(),
      },
    };
  }

  async installTool(tool: string, onProgress?: (line: string) => void): Promise<void> {
    const platformInstallers = TOOL_INSTALLERS[tool];
    if (!platformInstallers) {
      throw new Error(`No installer configured for tool: ${tool}`);
    }

    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const installer = platformInstallers[platform];
    if (!installer) {
      throw new Error(`No installer for ${tool} on platform ${platform}`);
    }

    const result = await runProcess(installer.command, installer.args, {
      timeout: 5 * 60 * 1000, // 5 minutes
      onProgress,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Installation of ${tool} failed (exit ${result.exitCode}): ${result.stderr}`);
    }
  }
}

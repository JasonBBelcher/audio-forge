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
}

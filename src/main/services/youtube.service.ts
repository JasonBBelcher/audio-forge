import { runProcess } from '../utils/process-runner.js';

export interface VideoFormat {
  format_id: string;
  format?: string;
  ext: string;
  height?: number;
  width?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
}

export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  uploader?: string;
  description?: string;
  upload_date?: string;
  formats?: VideoFormat[];
  thumbnail?: string;
}

export interface DownloadCommand {
  command: string;
  args: string[];
}

export interface DownloadOptions {
  format?: string;
  output?: string;
  audioOnly?: boolean;
}

export interface ProgressInfo {
  percent: number;
  filesize: string;
  speed: string;
  eta: string;
}

export class YouTubeService {
  async getInfo(url: string): Promise<VideoInfo> {
    this.validateUrl(url);

    const result = await runProcess('yt-dlp', ['-j', url], { timeout: 30000 });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to fetch video info: ${result.stderr}`);
    }

    return JSON.parse(result.stdout);
  }

  validateUrl(url: string): void {
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//;

    if (!youtubeRegex.test(url)) {
      throw new Error('Invalid YouTube URL');
    }
  }

  buildDownloadCommand(url: string, options: DownloadOptions = {}): DownloadCommand {
    this.validateUrl(url);

    const args: string[] = [];

    if (options.format) {
      args.push('-f', options.format);
    }

    if (options.audioOnly) {
      args.push('-x', '--audio-format', 'wav');
    }

    if (options.output) {
      args.push('-o', options.output);
    }

    args.push(url);

    return {
      command: 'yt-dlp',
      args,
    };
  }

  parseProgress(line: string): ProgressInfo | undefined {
    // Parse lines like: "[download] 45.5% of 5.32MiB at 1.23MiB/s ETA 00:03"
    const match = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+(.+)/);

    if (!match) {
      return undefined;
    }

    return {
      percent: parseFloat(match[1]),
      filesize: match[2],
      speed: match[3],
      eta: match[4],
    };
  }
}

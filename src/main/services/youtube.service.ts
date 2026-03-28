import { runProcess, getEnhancedEnv } from '../utils/process-runner.js';
import { spawn } from 'child_process';
import * as path from 'path';

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

  /**
   * Download audio from YouTube with progress callback support and AbortSignal.
   * Streams progress updates and can be cancelled via AbortController.
   */
  /**
   * Sanitize a string for use as a filesystem filename.
   * Removes characters that are illegal on common platforms.
   */
  sanitizeFileName(name: string): string {
    return name
      .replace(/[/\\:*?"<>|]/g, '_') // illegal chars on Windows/macOS/Linux
      .replace(/\s+/g, ' ')           // collapse whitespace
      .replace(/^\.+/, '')            // no leading dots
      .trim()
      .slice(0, 200);                 // cap length
  }

  async downloadWithProgress(
    url: string,
    outputDir: string,
    options: {
      trackId: string;
      fileName?: string;
      onProgress: (progress: { percent: number; speed?: string; eta?: string }) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ filePath: string }> {
    return new Promise((resolve, reject) => {
      const { trackId, fileName, onProgress, signal } = options;
      this.validateUrl(url);

      // Use sanitized video title as filename when available, fall back to trackId
      const baseName = fileName ? this.sanitizeFileName(fileName) : trackId;
      // Build yt-dlp args
      const outputTemplate = path.join(outputDir, `${baseName}.%(ext)s`);
      const args = [
        '-x',
        '--audio-format', 'wav',
        '--audio-quality', '0',
        '--no-playlist',
        '-o', outputTemplate,
        url,
      ];

      // Spawn yt-dlp process
      const proc = spawn('yt-dlp', args, { env: getEnhancedEnv() });
      let stdout = '';
      let lastFile = '';
      let settled = false;

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      // Handle AbortSignal
      if (signal) {
        const onAbort = () => {
          proc.kill('SIGTERM');
          settle(() => reject(new Error('Download aborted')));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort);
      }

      // Handle stdout for progress and filename extraction
      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;

        // Extract destination filename
        const destMatch = text.match(/\[ExtractAudio\] Destination: (.+)/);
        if (destMatch) {
          lastFile = destMatch[1].trim();
        }

        // Parse and emit progress
        const lines = text.split('\n');
        for (const line of lines) {
          const progress = this.parseProgress(line);
          if (progress) {
            onProgress({
              percent: progress.percent,
              speed: progress.speed,
              eta: progress.eta,
            });
          }
        }
      });

      // Handle errors
      proc.on('error', (err) => {
        settle(() => reject(err));
      });

      // Handle process completion
      proc.on('close', (code) => {
        if (code === 0) {
          settle(() => resolve({ filePath: lastFile }));
        } else {
          settle(() => reject(new Error(`yt-dlp exited with code ${code}: ${stdout}`)));
        }
      });
    });
  }
}

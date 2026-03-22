import { spawn } from 'child_process';

import os from 'os';

// Electron strips the shell PATH. Re-inject common tool locations so
// yt-dlp, ffmpeg, aubio etc. are found regardless of how the app is launched.
const TOOL_PATHS = [
  '/opt/homebrew/bin',                                  // Apple Silicon Homebrew
  '/usr/local/bin',                                     // Intel Homebrew
  `${os.homedir()}/.local/bin`,                         // pipx installs (all platforms)
  `${os.homedir()}/.audioforge-venv/bin`,               // AudioForge Python venv
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

export function getEnhancedEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const existingPath = process.env.PATH ?? '';
  const pathParts = existingPath.split(':');
  for (const p of TOOL_PATHS) {
    if (!pathParts.includes(p)) pathParts.unshift(p);
  }
  return { ...process.env, ...extra, PATH: pathParts.join(':') };
}

export interface RunProcessOptions {
  timeout?: number;
  signal?: AbortSignal;
  onProgress?: (data: string) => void;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface RunProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {}
): Promise<RunProcessResult> {
  return new Promise((resolve, reject) => {
    const { timeout, signal, onProgress, env, cwd } = options;

    const proc = spawn(command, args, {
      env: getEnhancedEnv(env),
      cwd: cwd ?? process.cwd(),
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    // Timeout
    let timer: NodeJS.Timeout | undefined;
    if (timeout) {
      timer = setTimeout(() => {
        proc.kill('SIGTERM');
        settle(() => reject(new Error(`Process timed out after ${timeout}ms`)));
      }, timeout);
    }

    // Abort signal
    if (signal) {
      const onAbort = () => {
        proc.kill('SIGTERM');
        settle(() => reject(new Error('Process aborted by AbortController')));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort);
    }

    proc.stdout.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      stdout += str;
      onProgress?.(str);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      stderr += str;
    });

    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      settle(() => reject(err));
    });

    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);
      settle(() =>
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        })
      );
    });
  });
}

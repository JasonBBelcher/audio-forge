import { execFile } from 'child_process';
import { EXTRA_PATH } from '../constants.js';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: `${EXTRA_PATH}:${process.env.PATH ?? ''}` };
    const child = execFile(cmd, args, { env, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && 'killed' in err && err.killed) {
        reject(new Error(`Process timed out after ${timeoutMs}ms: ${cmd}`));
        return;
      }
      const code = (err as NodeJS.ErrnoException & { code?: number } | null)?.code ?? 0;
      resolve({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: err ? code : 0 });
    });
  });
}

export async function which(tool: string): Promise<boolean> {
  try {
    const result = await run('which', [tool], 5000);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

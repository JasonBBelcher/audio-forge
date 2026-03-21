import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runProcess, RunProcessOptions, RunProcessResult } from '../../../../src/main/utils/process-runner.js';

describe('runProcess', () => {
  it('runs a command and returns stdout', async () => {
    const result = await runProcess('echo', ['hello']);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  it('returns stderr on error output', async () => {
    const result = await runProcess('node', ['-e', 'console.error("oops")']);
    expect(result.stderr.trim()).toBe('oops');
  });

  it('returns non-zero exit code on failure', async () => {
    const result = await runProcess('node', ['-e', 'process.exit(1)']);
    expect(result.exitCode).toBe(1);
  });

  it('rejects on timeout', async () => {
    await expect(
      runProcess('sleep', ['10'], { timeout: 100 })
    ).rejects.toThrow(/timed out/i);
  });

  it('calls onProgress callback with stdout lines', async () => {
    const onProgress = vi.fn();
    await runProcess('node', ['-e', 'console.log("line1"); console.log("line2")'], { onProgress });

    // Should have been called with stdout data
    expect(onProgress).toHaveBeenCalled();
    const allData = onProgress.mock.calls.map((c: any[]) => c[0]).join('');
    expect(allData).toContain('line1');
    expect(allData).toContain('line2');
  });

  it('can be cancelled via AbortController', async () => {
    const controller = new AbortController();

    const promise = runProcess('sleep', ['10'], { signal: controller.signal });

    // Cancel after a short delay
    setTimeout(() => controller.abort(), 50);

    await expect(promise).rejects.toThrow(/abort/i);
  });

  it('resolves with combined result object', async () => {
    const result = await runProcess('node', ['-e', 'console.log("out"); console.error("err")']);

    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('stderr');
    expect(result).toHaveProperty('exitCode');
    expect(result.stdout).toContain('out');
    expect(result.stderr).toContain('err');
  });
});

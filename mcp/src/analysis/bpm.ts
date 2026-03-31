import { run } from '../utils/process-runner.js';
import { TOOL_PATHS } from '../constants.js';

export async function analyzeBpm(filePath: string): Promise<number | null> {
  const result = await run(TOOL_PATHS.aubio, ['tempo', '-i', filePath]);
  if (result.exitCode !== 0) return null;

  const lines = result.stdout.trim().split('\n');
  const bpmValues = lines.map((l) => parseFloat(l)).filter((v) => !isNaN(v) && v > 0);
  if (bpmValues.length === 0) return null;

  // Average beat intervals to get BPM
  const avg = bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length;
  return Math.round(avg * 10) / 10;
}

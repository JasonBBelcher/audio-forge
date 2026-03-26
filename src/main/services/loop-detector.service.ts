/**
 * LoopDetectorService detects loop points and extracts loops from audio files.
 * Uses aubio for onset detection and BPM estimation to find loopable segments.
 */

import path from 'path';
import { runProcess } from '../utils/process-runner.js';

export interface LoopPoint {
  startSec: number;
  endSec: number;
  durationSec: number;
  confidence: number;
  bars: number;
  bpm?: number;
}

export interface LoopDetectionResult {
  loops: LoopPoint[];
  suggestedBpm?: number;
  totalDuration: number;
}

export class LoopDetectorService {
  /**
   * Detect loop points in an audio file.
   * - Estimates BPM from beat interval averages (not raw aubio output)
   * - Finds first strong onset for beat-aligned loop start
   * - Generates candidates at 1, 2, 4, 8 bar lengths
   * - Scores confidence by how closely each loop end aligns to an onset
   */
  async detectLoops(filePath: string, bpm?: number): Promise<LoopDetectionResult> {
    // ── Step 1: Detect BPM ────────────────────────────────────────────────
    let detectedBpm = bpm;
    if (!detectedBpm) {
      try {
        const result = await runProcess('aubio', ['tempo', filePath], { timeout: 30000 });
        const lines = result.stdout.trim().split('\n').filter((l) => l.trim());
        const timestamps = lines
          .map((l) => parseFloat(l.trim().split(/\s+/)[0]))
          .filter((n) => !isNaN(n) && n >= 0);

        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          const d = timestamps[i] - timestamps[i - 1];
          if (d > 0) intervals.push(d);
        }

        if (intervals.length > 0) {
          const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          detectedBpm = Math.round(60 / avg);
        }
      } catch {
        // fall through to default
      }
      detectedBpm = detectedBpm ?? 120;
    }

    // ── Step 2: Get total duration via ffprobe ────────────────────────────
    let totalDuration = 0;
    try {
      const r = await runProcess(
        'ffprobe',
        [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          filePath,
        ],
        { timeout: 30000 }
      );
      totalDuration = parseFloat(r.stdout.trim()) || 0;
    } catch {
      // continue without duration
    }

    // ── Step 3: Get onsets for beat-aligned start ─────────────────────────
    let onsets: number[] = [];
    try {
      const r = await runProcess('aubio', ['onset', filePath], { timeout: 30000 });
      onsets = r.stdout
        .trim()
        .split('\n')
        .map((l) => parseFloat(l.trim()))
        .filter((n) => !isNaN(n) && n > 0);
    } catch {
      // no onset data, start at 0
    }

    // ── Step 4: Find beat-aligned loop start ─────────────────────────────
    const barDurationSec = (60 / detectedBpm) * 4;

    // Use first onset within the first bar — gives a clean downbeat start
    const firstBarOnsets = onsets.filter((o) => o < barDurationSec);
    const startSec = firstBarOnsets.length > 0 ? firstBarOnsets[0] : 0;

    // ── Step 5: Build loop candidates ────────────────────────────────────
    const loops: LoopPoint[] = [];
    const barLengths = [1, 2, 4, 8];

    for (const bars of barLengths) {
      const durationSec = barDurationSec * bars;
      const endSec = startSec + durationSec;

      if (endSec > totalDuration) continue;

      // Score by onset alignment at loop end (within 50ms = tight snap)
      const snapThreshold = 0.05;
      const endSnaps = onsets.some((o) => Math.abs(o - endSec) < snapThreshold);
      const baseConfidence = bars === 1 ? 0.9 : bars === 2 ? 0.85 : bars === 4 ? 0.80 : 0.72;
      const confidence = endSnaps ? Math.min(baseConfidence + 0.05, 0.99) : baseConfidence;

      loops.push({
        startSec,
        endSec,
        durationSec,
        confidence,
        bars,
        bpm: detectedBpm,
      });
    }

    return {
      loops,
      suggestedBpm: detectedBpm,
      totalDuration,
    };
  }

  /**
   * Extract a loop segment from an audio file using ffmpeg.
   * Applies a 10ms fade-in/out for seamless looping.
   * Returns the output file path.
   */
  async extractLoop(
    filePath: string,
    loop: LoopPoint,
    outputPath?: string
  ): Promise<string> {
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);

    // Clean label: "1bar", "2bar", "4bar", "8bar"
    const label = `${loop.bars}bar`;
    const finalOutputPath = outputPath ?? path.join(dir, `${base}_loop_${label}${ext}`);

    const fadeTime = 0.01; // 10ms crossfade
    const filterStr = `afade=in:d=${fadeTime},afade=out:st=${loop.durationSec - fadeTime}:d=${fadeTime}`;

    const args = [
      '-i', filePath,
      '-ss', loop.startSec.toString(),
      '-t', loop.durationSec.toString(),
      '-filter:a', filterStr,
      '-y', finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Loop extraction failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }
}

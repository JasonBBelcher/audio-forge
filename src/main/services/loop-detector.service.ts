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
   * If BPM is provided, generates loop candidates at 1, 2, 4, 8 bar lengths.
   * If not, uses aubio to estimate tempo first.
   */
  async detectLoops(filePath: string, bpm?: number): Promise<LoopDetectionResult> {
    let detectedBpm = bpm;

    // If no BPM provided, try to detect it
    if (!detectedBpm) {
      try {
        const result = await runProcess('aubio', ['tempo', filePath], {
          timeout: 30000,
        });

        if (result.exitCode === 0) {
          detectedBpm = parseFloat(result.stdout.trim());
        }
      } catch (error) {
        // Fall back to a default BPM if aubio fails
        detectedBpm = 120;
      }
    }

    // Get audio duration
    let totalDuration = 0;
    try {
      const durationResult = await runProcess(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          filePath,
        ],
        { timeout: 30000 }
      );

      if (durationResult.exitCode === 0) {
        totalDuration = parseFloat(durationResult.stdout.trim());
      }
    } catch (error) {
      // Continue without duration info
    }

    // Calculate bar duration: 60 seconds / BPM * 4 beats per bar
    const barDurationSec = (60 / (detectedBpm || 120)) * 4;

    // Generate loop candidates at 1, 2, 4, 8 bar lengths
    const loops: LoopPoint[] = [];
    const barLengths = [1, 2, 4, 8];

    for (const bars of barLengths) {
      const durationSec = barDurationSec * bars;

      // Only add loop if it fits within the audio
      if (durationSec <= totalDuration) {
        loops.push({
          startSec: 0,
          endSec: durationSec,
          durationSec,
          confidence: 0.8, // High confidence for BPM-based detection
          bpm: detectedBpm,
        });
      }
    }

    return {
      loops,
      suggestedBpm: detectedBpm,
      totalDuration,
    };
  }

  /**
   * Extract a loop segment from an audio file.
   * Uses ffmpeg trim with crossfade for seamless looping.
   */
  async extractLoop(
    filePath: string,
    loop: LoopPoint,
    outputPath?: string
  ): Promise<string> {
    const finalOutputPath =
      outputPath ??
      filePath.replace(
        /\.[^.]+$/,
        `_loop_${loop.startSec}-${loop.endSec}.${path.extname(filePath).slice(1)}`
      );

    // Apply trim (-ss and -t) and add crossfade for loopability
    const fadeTime = 0.01; // 10ms fade
    const filterStr = `afade=in:d=${fadeTime},afade=out:st=${loop.durationSec - fadeTime}:d=${fadeTime}`;

    const args = [
      '-i',
      filePath,
      '-ss',
      loop.startSec.toString(),
      '-t',
      loop.durationSec.toString(),
      '-filter:a',
      filterStr,
      '-y',
      finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Loop extraction failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }
}

import * as path from 'path';
import { runProcess } from '../utils/process-runner.js';
import * as fs from 'fs';

export interface OffsetResult {
  offsetSec: number;       // seconds to delay target to align with reference
  confidence: number;      // 0–1, based on correlation peak strength
  method: 'correlation' | 'onset';
}

export interface SyncResult {
  outputPath: string;
  offsetApplied: number;
}

export class MediaSyncService {
  /**
   * Find the time offset between two audio files using aubio onset detection.
   * A positive offset means targetPath needs to be delayed to align with refPath.
   * Never throws; always returns a result with graceful fallback.
   */
  async findOffset(refPath: string, targetPath: string): Promise<OffsetResult> {
    try {
      // Validate inputs
      if (!refPath || !targetPath || typeof refPath !== 'string' || typeof targetPath !== 'string') {
        return { offsetSec: 0, confidence: 0, method: 'correlation' };
      }

      // Check if files exist
      if (!fs.existsSync(refPath) || !fs.existsSync(targetPath)) {
        return { offsetSec: 0, confidence: 0, method: 'correlation' };
      }

      // Get first onset time in each file using aubio
      const refOnset = await this.getFirstOnset(refPath);
      const targetOnset = await this.getFirstOnset(targetPath);

      // If aubio failed (returned -1), fallback gracefully
      if (refOnset === -1 || targetOnset === -1) {
        return { offsetSec: 0, confidence: 0, method: 'correlation' };
      }

      // Calculate offset: positive means target needs delay
      const offsetSec = refOnset - targetOnset;
      return {
        offsetSec,
        confidence: 0.8,
        method: 'onset',
      };
    } catch {
      // Graceful fallback on any error
      return { offsetSec: 0, confidence: 0, method: 'correlation' };
    }
  }

  /**
   * Get the first onset time in seconds from an audio file using aubio.
   * Returns -1 on failure.
   */
  private async getFirstOnset(filePath: string): Promise<number> {
    try {
      const result = await runProcess('aubio', ['onset', filePath], { timeout: 30000 });

      if (result.exitCode !== 0) {
        return -1;
      }

      const lines = result.stdout.trim().split('\n').filter(Boolean);
      if (lines.length === 0) {
        return -1;
      }

      const onsetTime = parseFloat(lines[0]);
      return isNaN(onsetTime) ? -1 : onsetTime;
    } catch {
      return -1;
    }
  }

  /**
   * Sync an audio track to a video by applying the computed offset, then mux.
   * Produces a new video file at outputPath with the synced audio.
   */
  async syncAudioWithVideo(
    videoPath: string,
    audioPath: string,
    offsetSec: number,
    outputPath: string
  ): Promise<SyncResult> {
    try {
      // Convert offset to milliseconds (ffmpeg adelay uses ms)
      const offsetMs = Math.round(offsetSec * 1000);

      const args = ['-i', videoPath, '-i', audioPath];

      // Check if videoPath has a video stream (detect via ffprobe or assume audio-only for now)
      // For simplicity, build the filter and map conditionally
      const filterParts: string[] = [];

      if (offsetSec >= 0) {
        // Audio is behind, apply delay using adelay
        const delayStr = `${offsetMs}|${offsetMs}`;
        filterParts.push(`[1:a]adelay=${delayStr}[delayed]`);
      } else {
        // Audio is ahead, trim it
        const trimSec = Math.abs(offsetSec);
        filterParts.push(`[1:a]atrim=start=${trimSec}[trimmed]`);
      }

      if (filterParts.length > 0) {
        args.push('-filter_complex', filterParts.join(';'));
      }

      // Try to map video if present, otherwise map only audio
      // We'll use 0:v? to make video optional (? = optional)
      const hasVideo = await this.hasVideoStream(videoPath);

      if (hasVideo) {
        args.push('-map', '0:v');
      }

      // Map the processed audio
      const audioLabel = offsetSec >= 0 ? '[delayed]' : '[trimmed]';
      if (filterParts.length > 0) {
        args.push('-map', audioLabel);
      } else {
        args.push('-map', '1:a');
      }

      // Codec settings
      if (hasVideo) {
        args.push('-c:v', 'copy');
      }
      args.push('-c:a', 'aac');
      args.push('-y', outputPath);

      const result = await runProcess('ffmpeg', args, { timeout: 60000 });

      if (result.exitCode !== 0) {
        throw new Error(`ffmpeg failed: ${result.stderr}`);
      }

      return {
        outputPath,
        offsetApplied: offsetSec,
      };
    } catch (err) {
      // Re-throw with context for caller to handle
      throw new Error(`Sync audio with video failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Check if a media file has a video stream.
   */
  private async hasVideoStream(filePath: string): Promise<boolean> {
    try {
      const result = await runProcess('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_type',
        '-of', 'csv=p=0',
        filePath,
      ], { timeout: 10000 });

      return result.stdout.toLowerCase().includes('video');
    } catch {
      return false;
    }
  }

  /**
   * Align multiple target recordings to a single reference.
   * Returns the output paths for each aligned recording.
   */
  async alignRecordings(
    refPath: string,
    targetPaths: string[],
    outputDir: string
  ): Promise<string[]> {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const results: string[] = [];

      for (const targetPath of targetPaths) {
        // Find offset
        const offsetResult = await this.findOffset(refPath, targetPath);

        // Generate output filename based on target
        const baseName = path.basename(targetPath, path.extname(targetPath));
        const outputPath = path.join(outputDir, `${baseName}_aligned${path.extname(targetPath)}`);

        // Sync using the reference and this target
        // Note: Using targetPath as both video and audio paths for audio-only files
        const syncResult = await this.syncAudioWithVideo(targetPath, targetPath, offsetResult.offsetSec, outputPath);

        results.push(syncResult.outputPath);
      }

      return results;
    } catch (err) {
      throw new Error(`Align recordings failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Find offset then sync in one step.
   */
  async autoSync(
    videoPath: string,
    audioPath: string,
    outputPath: string
  ): Promise<SyncResult> {
    try {
      // Extract audio from video first (if it's a video file)
      const tempAudio = path.join(path.dirname(outputPath), `.temp_extracted_${Math.random().toString(36).substring(7)}.wav`);

      try {
        // Try to extract audio from video
        await runProcess('ffmpeg', [
          '-i', videoPath,
          '-q:a', '9',
          '-y',
          tempAudio,
        ], { timeout: 30000 });
      } catch {
        // If extraction fails, video might already be audio-only
        // Proceed with original videoPath
      }

      const refAudio = fs.existsSync(tempAudio) ? tempAudio : videoPath;

      // Find offset between reference (from video) and provided audio
      const offsetResult = await this.findOffset(refAudio, audioPath);

      // Sync the provided audio with the video using the computed offset
      const syncResult = await this.syncAudioWithVideo(videoPath, audioPath, offsetResult.offsetSec, outputPath);

      // Clean up temp audio
      if (fs.existsSync(tempAudio)) {
        try {
          fs.unlinkSync(tempAudio);
        } catch {}
      }

      return syncResult;
    } catch (err) {
      throw new Error(`Auto sync failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

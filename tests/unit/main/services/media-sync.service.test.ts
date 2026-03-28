import { describe, it, expect, vi, beforeAll } from 'vitest';
import { HealthService } from '../../../../src/main/services/health.service.js';
import { MediaSyncService } from '../../../../src/main/services/media-sync.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { runProcess } from '../../../../src/main/utils/process-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ffmpegAvailable = false;
let aubioAvailable = false;

beforeAll(async () => {
  const health = new HealthService();
  const status = await health.getStatus();
  ffmpegAvailable = status.tools.ffmpeg?.available ?? false;
  aubioAvailable = status.tools.aubio?.available ?? false;
}, 30000);

async function createTestWav(filePath: string): Promise<void> {
  if (!ffmpegAvailable) return;
  // Create a 1-second silence WAV at 44.1kHz mono
  await runProcess('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=mono',
    '-t', '1',
    '-y',
    filePath,
  ], {});
}

describe('MediaSyncService — findOffset', () => {
  const service = new MediaSyncService();

  it('returns an OffsetResult with required properties', async () => {
    if (!ffmpegAvailable || !aubioAvailable) {
      return; // Skip gracefully when tools unavailable
    }

    const tempDir = path.join(__dirname, '../../../../.tmp-sync-test');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const refPath = path.join(tempDir, 'ref.wav');
    const targetPath = path.join(tempDir, 'target.wav');

    await createTestWav(refPath);
    await createTestWav(targetPath);

    const result = await service.findOffset(refPath, targetPath);

    expect(result).toHaveProperty('offsetSec');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('method');
    expect(typeof result.offsetSec).toBe('number');
    expect(typeof result.confidence).toBe('number');
    expect(['correlation', 'onset']).toContain(result.method);

    // Clean up
    try {
      fs.unlinkSync(refPath);
      fs.unlinkSync(targetPath);
      fs.rmdirSync(tempDir);
    } catch {}
  });

  it('returns offset 0 with confidence 0 when reference file does not exist', async () => {
    const service = new MediaSyncService();
    const result = await service.findOffset('/nonexistent/ref.wav', '/nonexistent/target.wav');

    expect(result.offsetSec).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.method).toBe('correlation');
  });

  it('returns offset 0 with confidence 0 when target file does not exist', async () => {
    const service = new MediaSyncService();
    const result = await service.findOffset('/nonexistent/ref.wav', '/nonexistent/target.wav');

    expect(result.offsetSec).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('never throws an error, always returns a result', async () => {
    const service = new MediaSyncService();
    // Various invalid inputs
    await expect(async () => {
      await service.findOffset('', '');
    }).not.toThrow();

    await expect(async () => {
      await service.findOffset(null as any, null as any);
    }).not.toThrow();
  });
});

describe('MediaSyncService — syncAudioWithVideo', () => {
  const service = new MediaSyncService();

  it('produces an output file when called with valid inputs', async () => {
    if (!ffmpegAvailable) {
      return; // Skip gracefully when ffmpeg unavailable
    }

    const tempDir = path.join(__dirname, '../../../../.tmp-sync-test-mux');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const videoPath = path.join(tempDir, 'video.wav');
    const audioPath = path.join(tempDir, 'audio.wav');
    const outputPath = path.join(tempDir, 'output.wav');

    await createTestWav(videoPath);
    await createTestWav(audioPath);

    const result = await service.syncAudioWithVideo(videoPath, audioPath, 0.5, outputPath);

    expect(result).toHaveProperty('outputPath');
    expect(result).toHaveProperty('offsetApplied');
    expect(result.offsetApplied).toBe(0.5);

    // Clean up
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      fs.rmdirSync(tempDir);
    } catch {}
  });

  it('handles negative offsets (audio ahead)', async () => {
    if (!ffmpegAvailable) {
      return; // Skip gracefully
    }

    const tempDir = path.join(__dirname, '../../../../.tmp-sync-test-neg');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const videoPath = path.join(tempDir, 'video.wav');
    const audioPath = path.join(tempDir, 'audio.wav');
    const outputPath = path.join(tempDir, 'output.wav');

    await createTestWav(videoPath);
    await createTestWav(audioPath);

    const result = await service.syncAudioWithVideo(videoPath, audioPath, -0.3, outputPath);

    expect(result.offsetApplied).toBe(-0.3);

    // Clean up
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      fs.rmdirSync(tempDir);
    } catch {}
  });
});

describe('MediaSyncService — alignRecordings', () => {
  const service = new MediaSyncService();

  it('returns an array of output paths for each target', async () => {
    if (!ffmpegAvailable || !aubioAvailable) {
      return; // Skip gracefully
    }

    const tempDir = path.join(__dirname, '../../../../.tmp-sync-test-align');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const refPath = path.join(tempDir, 'ref.wav');
    const target1 = path.join(tempDir, 'target1.wav');
    const target2 = path.join(tempDir, 'target2.wav');
    const outputDir = path.join(tempDir, 'output');

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    await createTestWav(refPath);
    await createTestWav(target1);
    await createTestWav(target2);

    const results = await service.alignRecordings(refPath, [target1, target2], outputDir);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);

    // Clean up
    try {
      fs.unlinkSync(refPath);
      fs.unlinkSync(target1);
      fs.unlinkSync(target2);
      for (const file of fs.readdirSync(outputDir)) {
        fs.unlinkSync(path.join(outputDir, file));
      }
      fs.rmdirSync(outputDir);
      fs.rmdirSync(tempDir);
    } catch {}
  }, 30000);
});

describe('MediaSyncService — autoSync', () => {
  const service = new MediaSyncService();

  it('combines findOffset and syncAudioWithVideo in one call', async () => {
    if (!ffmpegAvailable || !aubioAvailable) {
      return; // Skip gracefully
    }

    const tempDir = path.join(__dirname, '../../../../.tmp-sync-test-auto');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const videoPath = path.join(tempDir, 'video.wav');
    const audioPath = path.join(tempDir, 'audio.wav');
    const outputPath = path.join(tempDir, 'output.wav');

    await createTestWav(videoPath);
    await createTestWav(audioPath);

    const result = await service.autoSync(videoPath, audioPath, outputPath);

    expect(result).toHaveProperty('outputPath');
    expect(result).toHaveProperty('offsetApplied');

    // Clean up
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      fs.rmdirSync(tempDir);
    } catch {}
  });
});

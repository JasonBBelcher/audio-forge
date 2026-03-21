import path from 'path';
import { runProcess } from '../utils/process-runner.js';

export interface AudioMetadata {
  duration?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  bitrate?: string;
}

export interface ConvertOptions {
  bitrate?: string;
  sampleRate?: number;
  channels?: number;
}

export interface SeparateStemsOptions {
  model?: string;
  stems?: number;
  outputDir?: string;
}

export interface StemResult {
  vocals?: string;
  drums?: string;
  bass?: string;
  other?: string;
}

export interface AnalysisResult {
  bpm?: number;
  key?: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  waveformPeaks?: number[];
}

export class AudioService {
  async analyzeBPM(audioPath: string): Promise<{ bpm: number }> {
    const result = await runProcess('aubio', ['tempo', audioPath], { timeout: 30000 });

    if (result.exitCode !== 0) {
      throw new Error(`BPM analysis failed: ${result.stderr}`);
    }

    const bpm = parseFloat(result.stdout.trim());
    return { bpm };
  }

  async analyzeKey(audioPath: string): Promise<{ key: string }> {
    const result = await runProcess('aubio', ['pitch', audioPath], { timeout: 30000 });

    if (result.exitCode !== 0) {
      throw new Error(`Key analysis failed: ${result.stderr}`);
    }

    const key = result.stdout.trim();
    return { key };
  }

  async analyzeWaveform(audioPath: string): Promise<number[]> {
    const result = await runProcess(
      'ffmpeg',
      ['-i', audioPath, '-filter:a', 'astats=metadata=1:reset=1', '-f', 'null', '-'],
      { timeout: 30000 }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Waveform analysis failed: ${result.stderr}`);
    }

    // Parse peaks from output
    const peaks = result.stdout
      .split('\n')
      .filter((line) => line.includes('Peak'))
      .map((line) => {
        const match = line.match(/Peak:\s+([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
      });

    return peaks.length > 0 ? peaks : [0.5, 0.7, 0.9, 0.6];
  }

  async getMetadata(audioPath: string): Promise<AudioMetadata> {
    const result = await runProcess(
      'ffprobe',
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        audioPath,
      ],
      { timeout: 30000 }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Metadata extraction failed: ${result.stderr}`);
    }

    const data = JSON.parse(result.stdout);
    const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');

    return {
      duration: parseFloat(data.format?.duration),
      sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : undefined,
      channels: audioStream?.channels,
      codec: audioStream?.codec_name,
      bitrate: data.format?.bit_rate,
    };
  }

  async convertFormat(
    audioPath: string,
    format: string,
    options: ConvertOptions = {}
  ): Promise<string> {
    const outputPath = audioPath.replace(/\.[^.]+$/, `.${format}`);

    const args = ['-i', audioPath];

    if (options.bitrate) {
      args.push('-b:a', options.bitrate);
    }

    if (options.sampleRate) {
      args.push('-ar', options.sampleRate.toString());
    }

    if (options.channels) {
      args.push('-ac', options.channels.toString());
    }

    args.push('-y', outputPath);

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio conversion failed: ${result.stderr}`);
    }

    return outputPath;
  }

  async trim(audioPath: string, startSec: number, endSec: number): Promise<string> {
    const outputPath = audioPath.replace(/\.[^.]+$/, `.trimmed.${ path.extname(audioPath).slice(1)}`);

    const args = [
      '-i',
      audioPath,
      '-ss',
      startSec.toString(),
      '-to',
      endSec.toString(),
      '-c',
      'copy',
      '-y',
      outputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio trim failed: ${result.stderr}`);
    }

    return outputPath;
  }

  async normalize(audioPath: string, targetLUFS: number = -14): Promise<string> {
    const outputPath = audioPath.replace(/\.[^.]+$/, `.normalized.${ path.extname(audioPath).slice(1)}`);

    const args = [
      '-i',
      audioPath,
      '-filter:a',
      `loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`,
      '-y',
      outputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio normalization failed: ${result.stderr}`);
    }

    return outputPath;
  }

  async separateStems(audioPath: string, options: SeparateStemsOptions = {}): Promise<StemResult> {
    const model = options.model ?? 'demucs';
    const outputDir = options.outputDir ?? audioPath.replace(/\.[^.]+$/, '_stems');

    const args = ['-n', model, '-o', outputDir, audioPath];

    const result = await runProcess('demucs', args, { timeout: 1800000 });

    if (result.exitCode !== 0) {
      throw new Error(`Stem separation failed: ${result.stderr}`);
    }

    return {
      vocals: `${outputDir}/vocals.wav`,
      drums: `${outputDir}/drums.wav`,
      bass: `${outputDir}/bass.wav`,
      other: `${outputDir}/other.wav`,
    };
  }

  async fullAnalysis(audioPath: string): Promise<AnalysisResult> {
    const [bpmResult, keyResult, metadataResult, peaksResult] = await Promise.all([
      this.analyzeBPM(audioPath).catch(() => ({ bpm: undefined })),
      this.analyzeKey(audioPath).catch(() => ({ key: undefined })),
      this.getMetadata(audioPath),
      this.analyzeWaveform(audioPath).catch(() => []),
    ]);

    return {
      bpm: bpmResult.bpm,
      key: keyResult.key,
      duration: metadataResult.duration,
      sampleRate: metadataResult.sampleRate,
      channels: metadataResult.channels,
      waveformPeaks: peaksResult,
    };
  }

  async fadeIn(filePath: string, durationSec: number, outputPath?: string): Promise<string> {
    const finalOutputPath =
      outputPath ?? filePath.replace(/\.[^.]+$/, `_fadein.${path.extname(filePath).slice(1)}`);

    const args = [
      '-i',
      filePath,
      '-filter:a',
      `afade=t=in:ss=0:d=${durationSec}`,
      '-y',
      finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio fade in failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }

  async fadeOut(filePath: string, durationSec: number, outputPath?: string): Promise<string> {
    const finalOutputPath =
      outputPath ?? filePath.replace(/\.[^.]+$/, `_fadeout.${path.extname(filePath).slice(1)}`);

    // Get total duration first
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

    if (durationResult.exitCode !== 0) {
      throw new Error(`Duration detection failed: ${durationResult.stderr}`);
    }

    const totalDuration = parseFloat(durationResult.stdout.trim());
    const startTime = totalDuration - durationSec;

    const args = [
      '-i',
      filePath,
      '-filter:a',
      `afade=t=out:st=${startTime}:d=${durationSec}`,
      '-y',
      finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio fade out failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }

  async reverse(filePath: string, outputPath?: string): Promise<string> {
    const finalOutputPath =
      outputPath ?? filePath.replace(/\.[^.]+$/, `_reversed.${path.extname(filePath).slice(1)}`);

    const args = [
      '-i',
      filePath,
      '-filter:a',
      'areverse',
      '-y',
      finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio reverse failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }

  async pitchShift(filePath: string, semitones: number, outputPath?: string): Promise<string> {
    const semitoneSign = semitones >= 0 ? '+' : '';
    const finalOutputPath =
      outputPath ??
      filePath.replace(/\.[^.]+$/, `_pitch${semitoneSign}${semitones}st.${path.extname(filePath).slice(1)}`);

    // Calculate pitch ratio: 2^(semitones/12)
    const pitchRatio = Math.pow(2, semitones / 12);
    const filterStr = `rubberband=pitch=${pitchRatio}`;

    const args = [
      '-i',
      filePath,
      '-filter:a',
      filterStr,
      '-y',
      finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio pitch shift failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }

  async timeStretch(filePath: string, factor: number, outputPath?: string): Promise<string> {
    const finalOutputPath =
      outputPath ?? filePath.replace(/\.[^.]+$/, `_stretch${factor}x.${path.extname(filePath).slice(1)}`);

    // atempo expects 1/factor (factor > 1 = slower, factor < 1 = faster)
    const tempoValue = 1 / factor;
    const filterStr = `atempo=${tempoValue}`;

    const args = [
      '-i',
      filePath,
      '-filter:a',
      filterStr,
      '-y',
      finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio time stretch failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }

  async silenceRemove(filePath: string, thresholdDb: number = -50, outputPath?: string): Promise<string> {
    const finalOutputPath =
      outputPath ?? filePath.replace(/\.[^.]+$/, `_trimmed.${path.extname(filePath).slice(1)}`);

    const filterStr = `silenceremove=start_periods=1:start_silence=0.02:start_threshold=${thresholdDb}dB,areverse,silenceremove=start_periods=1:start_silence=0.02:start_threshold=${thresholdDb}dB,areverse`;

    const args = [
      '-i',
      filePath,
      '-filter:a',
      filterStr,
      '-y',
      finalOutputPath,
    ];

    const result = await runProcess('ffmpeg', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Audio silence removal failed: ${result.stderr}`);
    }

    return finalOutputPath;
  }

  async getDuration(filePath: string): Promise<number> {
    const result = await runProcess(
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

    if (result.exitCode !== 0) {
      throw new Error(`Duration detection failed: ${result.stderr}`);
    }

    return parseFloat(result.stdout.trim());
  }
}

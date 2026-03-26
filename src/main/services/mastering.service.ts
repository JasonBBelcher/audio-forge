import { spawn } from 'child_process';
import { getEnhancedEnv } from '../utils/process-runner.js';

export interface MasteringParams {
  inputPath: string;
  outputPath: string;
  eq: {
    lowFreq: number;
    lowGain: number;
    midFreq: number;
    midGain: number;
    midWidth: number;
    highFreq: number;
    highGain: number;
  };
  compressor: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
    makeupGain: number;
  };
  targetLufs: number;
  ceilingDbtp: number;
}

export interface MasteringAnalysis {
  inputLufs: number;
  inputPeakDb: number;
  inputDynamicRange: number;
}

export class MasteringService {
  async analyze(filePath: string): Promise<MasteringAnalysis> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', filePath,
        '-af', 'loudnorm=I=-23:TP=-2:LRA=7:print_format=json',
        '-f', 'null',
        '-'
      ];

      const process = spawn('ffmpeg', args, {
        env: getEnhancedEnv(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          // Return fallback values if loudnorm analysis fails (e.g., very short file)
          resolve({
            inputLufs: -23,
            inputPeakDb: -1,
            inputDynamicRange: 8
          });
          return;
        }

        try {
          // Extract JSON from stderr (loudnorm outputs to stderr)
          const jsonMatch = stderr.match(/\[loudnorm@[^\]]*\]([\s\S]*?)({[\s\S]*})/);
          if (jsonMatch && jsonMatch[2]) {
            const json = JSON.parse(jsonMatch[2]);
            resolve({
              inputLufs: parseFloat(json.input_i ?? -23),
              inputPeakDb: parseFloat(json.input_tp ?? -1),
              inputDynamicRange: parseFloat(json.input_lra ?? 8)
            });
          } else {
            // Fallback if parsing fails
            resolve({
              inputLufs: -23,
              inputPeakDb: -1,
              inputDynamicRange: 8
            });
          }
        } catch (err) {
          // Return fallback on any parsing error
          resolve({
            inputLufs: -23,
            inputPeakDb: -1,
            inputDynamicRange: 8
          });
        }
      });

      process.on('error', (err) => {
        reject(new Error(`Analysis process failed: ${err.message}`));
      });
    });
  }

  async master(params: MasteringParams): Promise<void> {
    return new Promise((resolve, reject) => {
      const filters: string[] = [];

      // Build EQ filter chain (only include bands with non-zero gain)
      const eqFilters: string[] = [];

      // Low shelf
      if (Math.abs(params.eq.lowGain) > 0.1) {
        const width = params.eq.lowFreq * 0.5;
        eqFilters.push(
          `equalizer=f=${params.eq.lowFreq}:width_type=h:width=${width}:g=${params.eq.lowGain}`
        );
      }

      // Mid peak
      if (Math.abs(params.eq.midGain) > 0.1) {
        eqFilters.push(
          `equalizer=f=${params.eq.midFreq}:width_type=o:width=${params.eq.midWidth}:g=${params.eq.midGain}`
        );
      }

      // High shelf
      if (Math.abs(params.eq.highGain) > 0.1) {
        const width = params.eq.highFreq * 0.5;
        eqFilters.push(
          `equalizer=f=${params.eq.highFreq}:width_type=h:width=${width}:g=${params.eq.highGain}`
        );
      }

      if (eqFilters.length > 0) {
        filters.push(eqFilters.join(','));
      }

      // Compressor (only if ratio > 1.1)
      if (params.compressor.ratio > 1.1) {
        filters.push(
          `acompressor=threshold=${params.compressor.threshold}dB:ratio=${params.compressor.ratio}:attack=${params.compressor.attack}:release=${params.compressor.release}:makeup=${params.compressor.makeupGain}dB`
        );
      }

      // Loudness normalization
      filters.push(
        `loudnorm=I=${params.targetLufs}:TP=${params.ceilingDbtp}:LRA=11`
      );

      // Limiter
      const linearCeiling = Math.pow(10, params.ceilingDbtp / 20);
      filters.push(
        `alimiter=level_in=1:level_out=1:limit=${linearCeiling}:attack=5:release=50`
      );

      const filterChain = filters.join(',');

      const args = [
        '-i', params.inputPath,
        '-af', filterChain,
        '-y', params.outputPath
      ];

      const process = spawn('ffmpeg', args, {
        env: getEnhancedEnv(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Mastering failed: ${stderr}`));
        } else {
          resolve();
        }
      });

      process.on('error', (err) => {
        reject(new Error(`Mastering process failed: ${err.message}`));
      });
    });
  }
}

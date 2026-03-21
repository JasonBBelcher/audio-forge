import type { AudioEngine } from './audioEngine';

export interface ExportTrack {
  id: string;
  volume: number;
  muted: boolean;
}

export interface ExportOptions {
  projectName: string;
  tracks: ExportTrack[];
  audioEngine: Pick<AudioEngine, 'getTrackBuffer'>;
  duration: number;
}

export interface ExportResult {
  success: boolean;
  canceled: boolean;
  filePath?: string;
  error?: string;
}

const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 2;
const BIT_DEPTH = 16;

/**
 * Encode an AudioBuffer to a WAV ArrayBuffer (16-bit PCM, little-endian).
 */
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = BIT_DEPTH / 8;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);                                    // PCM subchunk size
  view.setUint16(20, 1, true);                                     // AudioFormat = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
  view.setUint16(32, numChannels * bytesPerSample, true);          // BlockAlign
  view.setUint16(34, BIT_DEPTH, true);

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel samples as 16-bit signed PCM
  const offset = 44;
  const channelData = Array.from({ length: numChannels }, (_, ch) =>
    buffer.getChannelData(ch)
  );

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset + (i * numChannels + ch) * bytesPerSample, int16, true);
    }
  }

  return arrayBuffer;
}

export class ExportService {
  /**
   * Render all non-muted tracks with audio into a single AudioBuffer
   * using OfflineAudioContext (no real-time playback needed).
   */
  async renderMix(
    tracks: ExportTrack[],
    audioEngine: Pick<AudioEngine, 'getTrackBuffer'>,
    duration: number
  ): Promise<AudioBuffer> {
    const sampleRate = SAMPLE_RATE;
    const length = Math.max(1, Math.ceil(duration * sampleRate));

    const offlineCtx = new OfflineAudioContext(NUM_CHANNELS, length, sampleRate);

    for (const track of tracks) {
      if (track.muted) continue;
      const buffer = audioEngine.getTrackBuffer(track.id);
      if (!buffer) continue;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.value = track.volume;
      gainNode.connect(offlineCtx.destination);

      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(0);
    }

    return offlineCtx.startRendering();
  }

  /**
   * Full export flow: render mix → encode WAV → save dialog → write file.
   */
  async exportProject(options: ExportOptions): Promise<ExportResult> {
    const { projectName, tracks, audioEngine, duration } = options;
    const af = (window as any).audioforge;

    const dialogResult = await af.files.showSaveDialog({
      title: 'Export Mix',
      defaultPath: `${projectName}.wav`,
      filters: [
        { name: 'WAV Audio', extensions: ['wav'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { success: false, canceled: true };
    }

    const filePath: string = dialogResult.filePath;

    const rendered = await this.renderMix(tracks, audioEngine, duration);
    const wavBuffer = audioBufferToWav(rendered);
    const bytes = new Uint8Array(wavBuffer);

    await af.files.writeFile(filePath, bytes);

    return { success: true, canceled: false, filePath };
  }
}

export const exportService = new ExportService();

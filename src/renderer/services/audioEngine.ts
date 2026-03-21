import { playbackStore } from '../stores/playbackStore';

export interface AudioTrack {
  id: string;
  name: string;
  buffer: AudioBuffer | null;
  volume: number;
  muted: boolean;
  solo: boolean;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
}

class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private tracks: Map<string, AudioTrack> = new Map();
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private animationFrame: number | null = null;
  private isPlaying: boolean = false;
  private duration: number = 0;

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
    }
    return this.context;
  }

  async loadFile(trackId: string, file: File): Promise<void> {
    const ctx = this.getContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const existing = this.tracks.get(trackId);
    const track: AudioTrack = {
      id: trackId,
      name: file.name,
      buffer: audioBuffer,
      volume: existing?.volume ?? 1,
      muted: existing?.muted ?? false,
      solo: existing?.solo ?? false,
      sourceNode: null,
      gainNode: null,
    };

    this.tracks.set(trackId, track);

    // Update duration to longest track
    if (audioBuffer.duration > this.duration) {
      this.duration = audioBuffer.duration;
      playbackStore.setDuration(this.duration);
    }
  }

  play(): void {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    this.startTime = ctx.currentTime - this.pauseOffset;
    this.isPlaying = true;

    for (const [, track] of this.tracks) {
      if (!track.buffer) continue;
      this._startTrack(track);
    }

    playbackStore.play();
    this._tick();
  }

  pause(): void {
    const ctx = this.context;
    if (!ctx) return;

    this.pauseOffset = ctx.currentTime - this.startTime;
    this.isPlaying = false;

    for (const [, track] of this.tracks) {
      track.sourceNode?.stop();
      track.sourceNode = null;
    }

    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    playbackStore.pause();
  }

  stop(): void {
    this.pauseOffset = 0;
    this.isPlaying = false;

    for (const [, track] of this.tracks) {
      track.sourceNode?.stop();
      track.sourceNode = null;
    }

    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    playbackStore.stop();
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(volume, this.getContext().currentTime, 0.01);
    }
    playbackStore.setVolume(volume);
  }

  setTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    track.volume = volume;
    if (track.gainNode) {
      track.gainNode.gain.setTargetAtTime(
        track.muted ? 0 : volume,
        this.getContext().currentTime,
        0.01
      );
    }
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    track.muted = muted;
    if (track.gainNode) {
      const soloActive = [...this.tracks.values()].some(t => t.solo);
      const shouldMute = muted || (soloActive && !track.solo);
      track.gainNode.gain.setTargetAtTime(
        shouldMute ? 0 : track.volume,
        this.getContext().currentTime,
        0.01
      );
    }
  }

  setTrackSolo(trackId: string, solo: boolean): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    track.solo = solo;
    this._applySoloLogic();
  }

  seek(time: number): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();
    this.pauseOffset = time;
    playbackStore.seek(time);
    if (wasPlaying) this.play();
  }

  hasAudio(): boolean {
    return [...this.tracks.values()].some(t => t.buffer !== null);
  }

  getTrackBuffer(trackId: string): AudioBuffer | null {
    return this.tracks.get(trackId)?.buffer ?? null;
  }

  addTrack(trackId: string): void {
    if (!this.tracks.has(trackId)) {
      this.tracks.set(trackId, {
        id: trackId,
        name: '',
        buffer: null,
        volume: 1,
        muted: false,
        solo: false,
        sourceNode: null,
        gainNode: null,
      });
    }
  }

  removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.sourceNode?.stop();
      this.tracks.delete(trackId);
    }
    // Recalculate duration
    this.duration = 0;
    for (const t of this.tracks.values()) {
      if (t.buffer && t.buffer.duration > this.duration) {
        this.duration = t.buffer.duration;
      }
    }
    playbackStore.setDuration(this.duration);
  }

  private _startTrack(track: AudioTrack): void {
    const ctx = this.getContext();
    if (!track.buffer || !this.masterGain) return;

    const gainNode = ctx.createGain();
    const soloActive = [...this.tracks.values()].some(t => t.solo);
    const shouldMute = track.muted || (soloActive && !track.solo);
    gainNode.gain.value = shouldMute ? 0 : track.volume;
    gainNode.connect(this.masterGain);

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = track.buffer;
    sourceNode.connect(gainNode);

    const offset = Math.min(this.pauseOffset, track.buffer.duration);
    sourceNode.start(0, offset);

    sourceNode.onended = () => {
      if (this.isPlaying && this.pauseOffset >= this.duration - 0.1) {
        this.stop();
      }
    };

    track.gainNode = gainNode;
    track.sourceNode = sourceNode;
  }

  private _applySoloLogic(): void {
    const ctx = this.context;
    if (!ctx) return;
    const soloActive = [...this.tracks.values()].some(t => t.solo);

    for (const track of this.tracks.values()) {
      if (!track.gainNode) continue;
      const shouldMute = track.muted || (soloActive && !track.solo);
      track.gainNode.gain.setTargetAtTime(
        shouldMute ? 0 : track.volume,
        ctx.currentTime,
        0.01
      );
    }
  }

  private _tick(): void {
    if (!this.isPlaying || !this.context) return;

    const currentTime = this.context.currentTime - this.startTime;
    playbackStore.seek(currentTime);

    if (this.duration > 0 && currentTime >= this.duration) {
      this.stop();
      return;
    }

    this.animationFrame = requestAnimationFrame(() => this._tick());
  }
}

export const audioEngine = new AudioEngine();

// ─── Metronome ────────────────────────────────────────────────────────────────

class Metronome {
  private ctx: AudioContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private nextBeat: number = 0;
  private beat: number = 0;
  private bpm: number = 120;
  private active: boolean = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  start(bpm: number) {
    this.stop();
    this.bpm = bpm;
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    this.active = true;
    this.beat = 0;
    this.nextBeat = ctx.currentTime + 0.05;
    this.intervalId = setInterval(() => this._schedule(), 25);
  }

  stop() {
    this.active = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isActive() { return this.active; }

  private _schedule() {
    const ctx = this.getCtx();
    const lookAhead = 0.1;

    while (this.nextBeat < ctx.currentTime + lookAhead) {
      this._click(this.nextBeat, this.beat % 4 === 0);
      this.beat++;
      this.nextBeat += 60 / this.bpm;
    }
  }

  private _click(time: number, isDownbeat: boolean) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = isDownbeat ? 1000 : 800;
    gain.gain.setValueAtTime(isDownbeat ? 0.4 : 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.06);
  }
}

export const metronome = new Metronome();

// ─── Tap Tempo ────────────────────────────────────────────────────────────────

class TapTempo {
  private taps: number[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;

  tap(): number | null {
    const now = performance.now();
    if (this.timeout) clearTimeout(this.timeout);
    // Reset if gap > 3 seconds
    if (this.taps.length > 0 && now - this.taps[this.taps.length - 1] > 3000) {
      this.taps = [];
    }
    this.taps.push(now);
    // Expire tap history after 3 seconds of inactivity
    this.timeout = setTimeout(() => { this.taps = []; }, 3000);

    if (this.taps.length < 2) return null;

    const intervals = this.taps.slice(1).map((t, i) => t - this.taps[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.round(60000 / avg);
  }

  reset() { this.taps = []; }
}

export const tapTempo = new TapTempo();

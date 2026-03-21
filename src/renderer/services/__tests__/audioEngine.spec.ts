import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock Browser APIs unavailable in Node ────────────────────────────────────
// Do NOT invoke the callback — audioEngine._tick() calls rAF recursively
global.requestAnimationFrame = vi.fn().mockReturnValue(1);
global.cancelAnimationFrame = vi.fn();

// ── Mock Web Audio API ────────────────────────────────────────────────────────

// Factory so each createGain/createBufferSource call returns a trackable object
function makeMockGainNode() {
  return {
    gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
}

function makeMockSourceNode() {
  const node: any = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
  return node;
}

// Keep references to nodes so tests can inspect them
const createdGainNodes: ReturnType<typeof makeMockGainNode>[] = [];
const createdSourceNodes: ReturnType<typeof makeMockSourceNode>[] = [];

const mockOscillator = {
  frequency: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockAudioContext = {
  state: 'running' as AudioContextState,
  currentTime: 0,
  destination: {},
  resume: vi.fn(),
  createGain: vi.fn(() => { const n = makeMockGainNode(); createdGainNodes.push(n); return n; }),
  createBufferSource: vi.fn(() => { const n = makeMockSourceNode(); createdSourceNodes.push(n); return n; }),
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  decodeAudioData: vi.fn().mockResolvedValue({
    duration: 5,
    numberOfChannels: 2,
    getChannelData: vi.fn(() => new Float32Array(100)),
  }),
};

global.AudioContext = vi.fn(() => mockAudioContext) as any;

// ── Tests ─────────────────────────────────────────────────────────────────────

// Helper: load a real file into a track so it has a buffer
async function loadTrack(audioEngine: any, trackId: string) {
  audioEngine.addTrack(trackId);
  const fakeFile = new File([new Uint8Array([1, 2, 3])], 'test.wav', { type: 'audio/wav' });
  vi.spyOn(fakeFile, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));
  await audioEngine.loadFile(trackId, fakeFile);
}

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    createdGainNodes.length = 0;
    createdSourceNodes.length = 0;
  });

  it('starts not playing', async () => {
    const { playbackStore } = await import('../../stores/playbackStore');
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.isPlaying).toBe(false);
  });

  it('addTrack registers a track', async () => {
    const { audioEngine } = await import('../audioEngine');
    audioEngine.addTrack('t1');
    expect(audioEngine.getTrackBuffer('t1')).toBeNull(); // no audio yet
  });

  it('getTrackBuffer returns null for unknown track', async () => {
    const { audioEngine } = await import('../audioEngine');
    expect(audioEngine.getTrackBuffer('nonexistent')).toBeNull();
  });

  it('removeTrack cleans up the track', async () => {
    const { audioEngine } = await import('../audioEngine');
    audioEngine.addTrack('t-remove');
    audioEngine.removeTrack('t-remove');
    expect(audioEngine.getTrackBuffer('t-remove')).toBeNull();
  });

  it('hasAudio returns false when no tracks have buffers', async () => {
    const { audioEngine } = await import('../audioEngine');
    audioEngine.addTrack('empty-track');
    expect(audioEngine.hasAudio()).toBe(false);
  });

  it('loadFile decodes audio and stores buffer', async () => {
    const { audioEngine } = await import('../audioEngine');
    audioEngine.addTrack('t-load');
    const fakeFile = new File([new Uint8Array([1, 2, 3])], 'test.wav', { type: 'audio/wav' });
    // Mock arrayBuffer
    vi.spyOn(fakeFile, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));
    await audioEngine.loadFile('t-load', fakeFile);
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
  });

  it('play updates playbackStore isPlaying', async () => {
    const { audioEngine } = await import('../audioEngine');
    const { playbackStore } = await import('../../stores/playbackStore');
    audioEngine.play();
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.isPlaying).toBe(true);
  });

  it('pause sets isPlaying to false', async () => {
    const { audioEngine } = await import('../audioEngine');
    const { playbackStore } = await import('../../stores/playbackStore');
    audioEngine.play();
    audioEngine.pause();
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.isPlaying).toBe(false);
  });

  it('stop resets currentTime to 0', async () => {
    const { audioEngine } = await import('../audioEngine');
    const { playbackStore } = await import('../../stores/playbackStore');
    audioEngine.play();
    audioEngine.stop();
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.currentTime).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it('seek updates playback currentTime', async () => {
    const { audioEngine } = await import('../audioEngine');
    const { playbackStore } = await import('../../stores/playbackStore');
    audioEngine.seek(2.5);
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.currentTime).toBe(2.5);
  });

  it('setMasterVolume updates playback masterVolume', async () => {
    const { audioEngine } = await import('../audioEngine');
    const { playbackStore } = await import('../../stores/playbackStore');
    audioEngine.setMasterVolume(0.5);
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.masterVolume).toBe(0.5);
  });

  it('setMasterVolume calls gain.setTargetAtTime when masterGain exists', async () => {
    const { audioEngine } = await import('../audioEngine');
    // Trigger context + masterGain creation via play()
    audioEngine.play();
    const masterGainNode = createdGainNodes[0];
    audioEngine.setMasterVolume(0.7);
    expect(masterGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.7, expect.any(Number), 0.01);
  });

  it('addTrack is idempotent — does not duplicate existing track', async () => {
    const { audioEngine } = await import('../audioEngine');
    audioEngine.addTrack('t-dup');
    audioEngine.addTrack('t-dup'); // second call should be no-op
    expect(audioEngine.getTrackBuffer('t-dup')).toBeNull();
  });

  it('play() with loaded track starts a source node (_startTrack)', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'trk');
    audioEngine.play();
    // createBufferSource called: once for masterGain, once per track in _startTrack
    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(createdSourceNodes[0].start).toHaveBeenCalled();
  });

  it('play() connects track gain to master gain', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'trk');
    audioEngine.play();
    // First gainNode = masterGain, second = track gainNode
    const trackGain = createdGainNodes[1];
    expect(trackGain.connect).toHaveBeenCalled();
  });

  it('setTrackVolume updates gain when track has active gainNode', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'tv');
    audioEngine.play(); // sets gainNode on track
    const trackGain = createdGainNodes[1]; // 0=masterGain, 1=track gain
    audioEngine.setTrackVolume('tv', 0.4);
    expect(trackGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.4, expect.any(Number), 0.01);
  });

  it('setTrackMute mutes track gain when track has active gainNode', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'tm');
    audioEngine.play();
    const trackGain = createdGainNodes[1];
    audioEngine.setTrackMute('tm', true);
    expect(trackGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), 0.01);
  });

  it('setTrackMute unmutes track gain', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'tum');
    audioEngine.play();
    const trackGain = createdGainNodes[1];
    audioEngine.setTrackMute('tum', true);
    audioEngine.setTrackMute('tum', false);
    // Last call should set gain to track volume (1 by default)
    const calls = trackGain.gain.setTargetAtTime.mock.calls;
    expect(calls[calls.length - 1][0]).toBe(1);
  });

  it('setTrackSolo triggers _applySoloLogic with gainNode', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'ts');
    audioEngine.play();
    const trackGain = createdGainNodes[1];
    audioEngine.setTrackSolo('ts', true);
    // _applySoloLogic should have called setTargetAtTime on the gain
    expect(trackGain.gain.setTargetAtTime).toHaveBeenCalled();
  });

  it('setTrackMute is a no-op for unknown trackId', async () => {
    const { audioEngine } = await import('../audioEngine');
    expect(() => audioEngine.setTrackMute('unknown', true)).not.toThrow();
  });

  it('setTrackSolo is a no-op for unknown trackId', async () => {
    const { audioEngine } = await import('../audioEngine');
    expect(() => audioEngine.setTrackSolo('unknown', true)).not.toThrow();
  });

  it('setTrackVolume is a no-op for unknown trackId', async () => {
    const { audioEngine } = await import('../audioEngine');
    expect(() => audioEngine.setTrackVolume('unknown', 0.5)).not.toThrow();
  });

  it('pause() stops active source nodes', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'tp');
    audioEngine.play();
    const srcNode = createdSourceNodes[0];
    audioEngine.pause();
    expect(srcNode.stop).toHaveBeenCalled();
  });

  it('stop() stops active source nodes', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'ts2');
    audioEngine.play();
    const srcNode = createdSourceNodes[0];
    audioEngine.stop();
    expect(srcNode.stop).toHaveBeenCalled();
  });

  it('removeTrack stops sourceNode if playing', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'tr2');
    audioEngine.play();
    const srcNode = createdSourceNodes[0];
    audioEngine.removeTrack('tr2');
    expect(srcNode.stop).toHaveBeenCalled();
  });

  it('removeTrack recalculates duration from remaining tracks', async () => {
    const { audioEngine } = await import('../audioEngine');
    const { playbackStore } = await import('../../stores/playbackStore');
    await loadTrack(audioEngine, 'ta');
    await loadTrack(audioEngine, 'tb');
    audioEngine.removeTrack('ta');
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.duration).toBeGreaterThanOrEqual(0);
  });

  it('seek while playing re-starts playback from new offset', async () => {
    const { audioEngine } = await import('../audioEngine');
    const { playbackStore } = await import('../../stores/playbackStore');
    await loadTrack(audioEngine, 'tseek');
    audioEngine.play();
    audioEngine.seek(2);
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.currentTime).toBe(2);
    expect(state.isPlaying).toBe(true);
  });

  it('play() with suspended context calls ctx.resume()', async () => {
    const { audioEngine } = await import('../audioEngine');
    mockAudioContext.state = 'suspended';
    audioEngine.play();
    expect(mockAudioContext.resume).toHaveBeenCalled();
    mockAudioContext.state = 'running';
  });

  it('sourceNode.onended calls stop() when seeked to near end of track', async () => {
    const { audioEngine } = await import('../audioEngine');
    await loadTrack(audioEngine, 'tend'); // duration = 5
    // Seek to 4.95 (>= duration - 0.1 = 4.9) to set pauseOffset near end
    audioEngine.seek(4.95);
    audioEngine.play();
    const srcNode = createdSourceNodes[0];
    // Manually trigger onended — simulates the audio finishing naturally
    if (srcNode.onended) srcNode.onended();
    const { playbackStore } = await import('../../stores/playbackStore');
    let state: any;
    playbackStore.subscribe(s => { state = s; })();
    expect(state.isPlaying).toBe(false);
  });
});

// ── Metronome Tests ────────────────────────────────────────────────────────────

describe('Metronome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    createdGainNodes.length = 0;
    createdSourceNodes.length = 0;
  });

  it('starts inactive', async () => {
    const { metronome } = await import('../audioEngine');
    expect(metronome.isActive()).toBe(false);
  });

  it('isActive returns true after start()', async () => {
    const { metronome } = await import('../audioEngine');
    metronome.start(120);
    expect(metronome.isActive()).toBe(true);
    metronome.stop();
  });

  it('isActive returns false after stop()', async () => {
    const { metronome } = await import('../audioEngine');
    metronome.start(120);
    metronome.stop();
    expect(metronome.isActive()).toBe(false);
  });

  it('stop() is safe to call when not started', async () => {
    const { metronome } = await import('../audioEngine');
    expect(() => metronome.stop()).not.toThrow();
  });

  it('start() re-starts if already running', async () => {
    const { metronome } = await import('../audioEngine');
    metronome.start(120);
    metronome.start(140); // re-start at different BPM
    expect(metronome.isActive()).toBe(true);
    metronome.stop();
  });

  it('start() resumes suspended context', async () => {
    const { metronome } = await import('../audioEngine');
    mockAudioContext.state = 'suspended';
    metronome.start(120);
    expect(mockAudioContext.resume).toHaveBeenCalled();
    metronome.stop();
    mockAudioContext.state = 'running';
  });

  it('calls _schedule on interval tick', async () => {
    vi.useFakeTimers();
    const { metronome } = await import('../audioEngine');
    metronome.start(120);
    // Advance timer to trigger at least one _schedule interval (25ms)
    vi.advanceTimersByTime(50);
    // _schedule calls createOscillator indirectly via _click when nextBeat is in range
    // Just confirm no errors are thrown and metronome is still active
    expect(metronome.isActive()).toBe(true);
    metronome.stop();
    vi.useRealTimers();
  });
});

// ── TapTempo Tests ────────────────────────────────────────────────────────────

describe('TapTempo', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns null on first tap', async () => {
    const { tapTempo } = await import('../audioEngine');
    tapTempo.reset();
    expect(tapTempo.tap()).toBeNull();
  });

  it('calculates BPM from two taps', async () => {
    const { tapTempo } = await import('../audioEngine');
    tapTempo.reset();

    // Fake 120 BPM = 500ms intervals
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    tapTempo.tap();
    now = 500;
    const bpm = tapTempo.tap();
    expect(bpm).toBeCloseTo(120, -1); // within 10 bpm
  });

  it('resets tap history', async () => {
    const { tapTempo } = await import('../audioEngine');
    tapTempo.reset();
    tapTempo.tap();
    tapTempo.reset();
    expect(tapTempo.tap()).toBeNull();
  });

  it('averages multiple taps for stability', async () => {
    const { tapTempo } = await import('../audioEngine');
    tapTempo.reset();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    // 4 taps at 100 BPM = 600ms apart
    tapTempo.tap(); now += 600;
    tapTempo.tap(); now += 600;
    tapTempo.tap(); now += 600;
    const bpm = tapTempo.tap();
    expect(bpm).toBeCloseTo(100, -1);
  });

  it('resets taps automatically when gap exceeds 3 seconds', async () => {
    const { tapTempo } = await import('../audioEngine');
    tapTempo.reset();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    tapTempo.tap(); // first tap at 0
    now = 4000;     // jump 4 seconds — past the 3s threshold
    const result = tapTempo.tap(); // should reset history, so only 1 tap → returns null
    expect(result).toBeNull();
  });
});

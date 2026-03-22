import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SP404MidiService } from '../../../../src/main/services/sp404-midi.service.js';

// ─── Mock MIDI factory helpers ───────────────────────────────────────────────

/**
 * Creates a self-contained mock MIDI module that simulates the @julusian/midi
 * API surface used by SP404MidiService.
 */
function createMockMidi() {
  const inputMessageListeners: Array<(delta: number, msg: number[]) => void> = [];
  const outputSent: number[][] = [];

  const mockInput = {
    getPortCount: vi.fn().mockReturnValue(2),
    getPortName: vi.fn().mockImplementation((i: number) => ['SP-404 MK2 MIDI 1', 'IAC Driver'][i] ?? ''),
    openPort: vi.fn(),
    closePort: vi.fn(),
    on: vi.fn().mockImplementation((event: string, cb: (delta: number, msg: number[]) => void) => {
      if (event === 'message') {
        inputMessageListeners.push(cb);
      }
    }),
    // Helper: push a message to all registered listeners as the hardware would
    _trigger: (msg: number[]) => {
      inputMessageListeners.forEach((cb) => cb(0, msg));
    },
  };

  const mockOutput = {
    getPortCount: vi.fn().mockReturnValue(2),
    getPortName: vi.fn().mockImplementation((i: number) => ['SP-404 MK2 MIDI 1', 'IAC Driver'][i] ?? ''),
    openPort: vi.fn(),
    closePort: vi.fn(),
    sendMessage: vi.fn().mockImplementation((msg: number[]) => outputSent.push(msg)),
  };

  return {
    Input: vi.fn().mockReturnValue(mockInput),
    Output: vi.fn().mockReturnValue(mockOutput),
    mockInput,
    mockOutput,
    outputSent,
    // Expose trigger for tests that need to simulate hardware messages after connect
    triggerMessage: (msg: number[]) => mockInput._trigger(msg),
  };
}

/** Creates a service backed by a working mock MIDI module. */
function createService(midiMock?: ReturnType<typeof createMockMidi>) {
  const mock = midiMock ?? createMockMidi();
  const service = new SP404MidiService(() => mock);
  return { service, mock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SP404MidiService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. listPorts returns empty arrays when MIDI module unavailable
  describe('listPorts()', () => {
    it('returns empty arrays when MIDI module is unavailable', () => {
      const service = new SP404MidiService(() => null);
      const result = service.listPorts();
      expect(result).toEqual({ inputs: [], outputs: [] });
    });

    // 2. listPorts returns port names from mock MIDI module
    it('returns port names from mock MIDI module', () => {
      const { service } = createService();
      const result = service.listPorts();
      expect(result.inputs).toEqual(['SP-404 MK2 MIDI 1', 'IAC Driver']);
      expect(result.outputs).toEqual(['SP-404 MK2 MIDI 1', 'IAC Driver']);
    });
  });

  // 3. connect returns error when port not found
  describe('connect()', () => {
    it('returns error when input port name is not found', () => {
      const { service } = createService();
      const result = service.connect('NonExistentPort', 'SP-404 MK2 MIDI 1');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('NonExistentPort');
    });

    it('returns error when output port name is not found', () => {
      const { service } = createService();
      const result = service.connect('SP-404 MK2 MIDI 1', 'GhostOutput');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('GhostOutput');
    });

    it('returns error when MIDI module is unavailable', () => {
      const service = new SP404MidiService(() => null);
      const result = service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    // 4. connect opens input/output and emits 'status' with connected=true
    it('opens input/output ports and emits status with connected=true', () => {
      const { service, mock } = createService();

      const result = service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      // Listen after connect to capture any subsequent status changes, and verify
      // current state directly.
      expect(result.ok).toBe(true);
      expect(mock.mockInput.openPort).toHaveBeenCalledWith(0);
      expect(mock.mockOutput.openPort).toHaveBeenCalledWith(0);
      expect(service.isConnected()).toBe(true);
      expect(service.getStatus()).toMatchObject({ connected: true, portName: 'SP-404 MK2 MIDI 1' });
    });

    it('emits a connected=true status event during connect', () => {
      const { service } = createService();

      // connect() calls disconnect() internally which emits connected=false,
      // then emits connected=true for the new connection. Assert on final event.
      const statusEvents: any[] = [];
      service.on('status', (s) => statusEvents.push(s));

      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const lastStatus = statusEvents[statusEvents.length - 1];
      expect(lastStatus).toMatchObject({ connected: true, portName: 'SP-404 MK2 MIDI 1' });
    });

    it('registers a message listener on the input', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');
      expect(mock.mockInput.on).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  // 5. sendStart sends 0xFA and emits 'transport' with playing=true
  describe('sendStart()', () => {
    it('sends MIDI Start byte 0xFA and emits transport playing=true', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const transportEvents: any[] = [];
      service.on('transport', (e) => transportEvents.push(e));

      service.sendStart();

      expect(mock.outputSent).toContainEqual([0xFA]);
      expect(transportEvents).toHaveLength(1);
      expect(transportEvents[0]).toMatchObject({ playing: true, source: 'app' });
    });

    it('does not throw when output is not open', () => {
      const { service } = createService();
      // Do not call connect — output is null
      expect(() => service.sendStart()).not.toThrow();
    });
  });

  // 6. sendStop sends 0xFC and emits 'transport' with playing=false
  describe('sendStop()', () => {
    it('sends MIDI Stop byte 0xFC and emits transport playing=false', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');
      service.sendStart(); // start first

      mock.outputSent.length = 0; // reset
      const transportEvents: any[] = [];
      service.on('transport', (e) => transportEvents.push(e));

      service.sendStop();

      expect(mock.outputSent).toContainEqual([0xFC]);
      expect(transportEvents).toHaveLength(1);
      expect(transportEvents[0]).toMatchObject({ playing: false, source: 'app' });
    });
  });

  // 7. handleMessage with 0xFA (Start) emits transport { playing: true, source: 'hardware' }
  describe('handleMessage() — hardware MIDI Start (0xFA)', () => {
    it('emits transport event with playing=true and source=hardware', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const transportEvents: any[] = [];
      service.on('transport', (e) => transportEvents.push(e));

      mock.triggerMessage([0xFA]);

      expect(transportEvents).toHaveLength(1);
      expect(transportEvents[0]).toMatchObject({ playing: true, source: 'hardware' });
    });
  });

  // 8. handleMessage with 0xFC (Stop) emits transport { playing: false, source: 'hardware' }
  describe('handleMessage() — hardware MIDI Stop (0xFC)', () => {
    it('emits transport event with playing=false and source=hardware', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const transportEvents: any[] = [];
      service.on('transport', (e) => transportEvents.push(e));

      mock.triggerMessage([0xFC]);

      expect(transportEvents).toHaveLength(1);
      expect(transportEvents[0]).toMatchObject({ playing: false, source: 'hardware' });
    });
  });

  // 8b. handleMessage with 0xFB (Continue)
  describe('handleMessage() — hardware MIDI Continue (0xFB)', () => {
    it('emits transport event with playing=true and source=hardware', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const transportEvents: any[] = [];
      service.on('transport', (e) => transportEvents.push(e));

      mock.triggerMessage([0xFB]);

      expect(transportEvents).toHaveLength(1);
      expect(transportEvents[0]).toMatchObject({ playing: true, source: 'hardware' });
    });
  });

  // 9. handleMessage with 0x90 Note On emits 'padTrigger' with correct padLabel
  describe('handleMessage() — Note On pad trigger', () => {
    it('emits padTrigger with correct padLabel for note 36 (A1)', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const padEvents: any[] = [];
      service.on('padTrigger', (e) => padEvents.push(e));

      // Note On channel 1, note 36, velocity 100
      mock.triggerMessage([0x90, 36, 100]);

      expect(padEvents).toHaveLength(1);
      expect(padEvents[0]).toMatchObject({ note: 36, padLabel: 'A1', velocity: 100, on: true });
    });

    it('emits padTrigger for note 67 (D8)', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const padEvents: any[] = [];
      service.on('padTrigger', (e) => padEvents.push(e));

      mock.triggerMessage([0x90, 67, 80]);

      expect(padEvents).toHaveLength(1);
      expect(padEvents[0]).toMatchObject({ note: 67, padLabel: 'D8', velocity: 80, on: true });
    });

    it('emits padTrigger with null padLabel for unmapped note', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const padEvents: any[] = [];
      service.on('padTrigger', (e) => padEvents.push(e));

      // Note 35 is below the SP-404 range
      mock.triggerMessage([0x90, 35, 64]);

      expect(padEvents).toHaveLength(1);
      expect(padEvents[0]).toMatchObject({ note: 35, padLabel: null, on: true });
    });

    it('emits padTrigger with on=false for Note On with velocity 0', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const padEvents: any[] = [];
      service.on('padTrigger', (e) => padEvents.push(e));

      mock.triggerMessage([0x90, 36, 0]);

      expect(padEvents).toHaveLength(1);
      expect(padEvents[0]).toMatchObject({ note: 36, padLabel: 'A1', velocity: 0, on: false });
    });

    it('emits padTrigger with on=false for explicit Note Off (0x80)', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const padEvents: any[] = [];
      service.on('padTrigger', (e) => padEvents.push(e));

      mock.triggerMessage([0x80, 44, 0]);

      expect(padEvents).toHaveLength(1);
      expect(padEvents[0]).toMatchObject({ note: 44, padLabel: 'B1', velocity: 0, on: false });
    });
  });

  // 10. handleMessage with 24 clock pulses computes BPM correctly
  describe('handleMessage() — MIDI clock BPM detection', () => {
    it('detects BPM from 24 evenly spaced clock pulses and emits bpm event', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      // Start from a non-120 BPM so the 120-BPM clock signal triggers a change event.
      service.setBpm(90);

      const bpmEvents: any[] = [];
      service.on('bpm', (e) => bpmEvents.push(e));

      // Simulate 24 clock pulses evenly spaced for 120 BPM.
      // 120 BPM => 500 ms/beat => 500/24 ≈ 20.833 ms per clock pulse.
      // Pre-compute the timestamp sequence and feed them in order via the spy.
      const baseTime = 1_000_000;
      const pulseIntervalMs = 500 / 24; // ~20.833 ms
      const timestamps = Array.from({ length: 24 }, (_, i) => Math.round(baseTime + i * pulseIntervalMs));

      // mockReturnValueOnce queues return values in FIFO order — one per Date.now() call.
      const dateNowSpy = vi.spyOn(Date, 'now');
      timestamps.forEach((t) => dateNowSpy.mockReturnValueOnce(t));

      for (let i = 0; i < 24; i++) {
        mock.triggerMessage([0xF8]);
      }

      dateNowSpy.mockRestore();

      // Should have emitted at least one BPM event (90 → ~120, well above 0.5 threshold)
      expect(bpmEvents.length).toBeGreaterThanOrEqual(1);
      const detectedBpm = bpmEvents[bpmEvents.length - 1].bpm;
      // Allow ±2 BPM tolerance for floating-point timing
      expect(detectedBpm).toBeGreaterThan(118);
      expect(detectedBpm).toBeLessThan(122);
    });

    it('does not emit bpm event when fewer than 24 pulses received', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const bpmEvents: any[] = [];
      service.on('bpm', (e) => bpmEvents.push(e));

      // Send only 23 pulses — not enough to calculate BPM
      for (let i = 0; i < 23; i++) {
        mock.triggerMessage([0xF8]);
      }

      expect(bpmEvents).toHaveLength(0);
    });
  });

  // 11. setBpm clamps to [20, 300]
  describe('setBpm()', () => {
    it('clamps bpm below 20 to 20', () => {
      const { service } = createService();
      service.setBpm(5);
      expect(service.getStatus().bpm).toBe(20);
    });

    it('clamps bpm above 300 to 300', () => {
      const { service } = createService();
      service.setBpm(999);
      expect(service.getStatus().bpm).toBe(300);
    });

    it('accepts valid bpm within range', () => {
      const { service } = createService();
      service.setBpm(140);
      expect(service.getStatus().bpm).toBe(140);
    });

    it('accepts boundary value 20', () => {
      const { service } = createService();
      service.setBpm(20);
      expect(service.getStatus().bpm).toBe(20);
    });

    it('accepts boundary value 300', () => {
      const { service } = createService();
      service.setBpm(300);
      expect(service.getStatus().bpm).toBe(300);
    });
  });

  // 12. disconnect emits 'status' with connected=false
  describe('disconnect()', () => {
    it('emits status event with connected=false', () => {
      const { service } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');

      const statusEvents: any[] = [];
      service.on('status', (s) => statusEvents.push(s));

      service.disconnect();

      expect(service.isConnected()).toBe(false);
      // The most recent status event should be the disconnect
      const lastStatus = statusEvents[statusEvents.length - 1];
      expect(lastStatus).toMatchObject({ connected: false, portName: null });
    });

    it('is a no-op and does not throw when called while not connected', () => {
      const { service } = createService();
      expect(() => service.disconnect()).not.toThrow();
    });

    it('closes both input and output ports', () => {
      const { service, mock } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');
      service.disconnect();

      expect(mock.mockInput.closePort).toHaveBeenCalled();
      expect(mock.mockOutput.closePort).toHaveBeenCalled();
    });
  });

  // Additional: getStatus reflects current state
  describe('getStatus()', () => {
    it('returns disconnected state before connect', () => {
      const { service } = createService();
      const status = service.getStatus();
      expect(status).toMatchObject({ connected: false, portName: null, bpm: 120, playing: false });
    });

    it('returns connected state after connect', () => {
      const { service } = createService();
      service.connect('SP-404 MK2 MIDI 1', 'SP-404 MK2 MIDI 1');
      const status = service.getStatus();
      expect(status.connected).toBe(true);
      expect(status.portName).toBe('SP-404 MK2 MIDI 1');
    });
  });
});

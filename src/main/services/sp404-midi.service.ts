import { EventEmitter } from 'events';

// Dynamic require shim — same pattern as emx1.service.ts.
// Tries legacy 'midi' name first, then the maintained '@julusian/midi' fork.
function getMidiModule(): any {
  for (const id of ['midi', '@julusian/midi']) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(id);
    } catch {
      // continue
    }
  }
  return null;
}

export interface SP404MidiStatus {
  connected: boolean;
  portName: string | null;
  bpm: number;
  playing: boolean;
}

export interface SP404TransportEvent {
  playing: boolean;
  bpm: number;
  source: 'hardware' | 'app';
}

export interface SP404PlayheadEvent {
  step: number;
}

export interface SP404PadTriggerEvent {
  note: number;
  padLabel: string | null;
  velocity: number;
  on: boolean;
}

export interface SP404BpmEvent {
  bpm: number;
}

/**
 * SP404MidiService manages MIDI clock sync and pad triggers for the SP-404 MK2.
 * Extends EventEmitter to broadcast real-time MIDI events to IPC handlers.
 *
 * Events emitted:
 *   'transport'   — SP404TransportEvent  (play/stop from hardware or app)
 *   'playhead'    — SP404PlayheadEvent   (step position, 0-15)
 *   'padTrigger'  — SP404PadTriggerEvent (note on/off with pad label)
 *   'bpm'         — SP404BpmEvent        (BPM detected from incoming clock)
 *   'status'      — { connected, portName } (connection state changes)
 */
export class SP404MidiService extends EventEmitter {
  private midi: any = null;
  private input: any = null;
  private output: any = null;
  private connected: boolean = false;
  private portName: string | null = null;
  private clockTicks: number = 0;
  private clockTimes: number[] = [];
  private playing: boolean = false;
  private bpm: number = 120;
  private masterClock: NodeJS.Timeout | null = null;

  // SP-404 MK2 pad-to-note mapping: MIDI channel 10, notes 36–67
  private static readonly PAD_MAP: Record<number, string> = {
    36: 'A1', 37: 'A2', 38: 'A3', 39: 'A4',
    40: 'A5', 41: 'A6', 42: 'A7', 43: 'A8',
    44: 'B1', 45: 'B2', 46: 'B3', 47: 'B4',
    48: 'B5', 49: 'B6', 50: 'B7', 51: 'B8',
    52: 'C1', 53: 'C2', 54: 'C3', 55: 'C4',
    56: 'C5', 57: 'C6', 58: 'C7', 59: 'C8',
    60: 'D1', 61: 'D2', 62: 'D3', 63: 'D4',
    64: 'D5', 65: 'D6', 66: 'D7', 67: 'D8',
  };

  /**
   * Optional factory injected during tests so unit tests can supply a mock MIDI module
   * without touching require() or the real hardware.
   */
  constructor(private midiFactory?: () => any) {
    super();
  }

  private getMidi(): any {
    if (this.midiFactory) return this.midiFactory();
    return getMidiModule();
  }

  /**
   * List all available MIDI input and output port names.
   * Returns empty arrays when the MIDI module is unavailable (e.g. in CI).
   */
  listPorts(): { inputs: string[]; outputs: string[] } {
    const midi = this.getMidi();
    if (!midi) {
      return { inputs: [], outputs: [] };
    }

    try {
      const tempInput = new midi.Input();
      const tempOutput = new midi.Output();

      const inputs: string[] = [];
      const outputs: string[] = [];

      const inputCount: number = tempInput.getPortCount();
      for (let i = 0; i < inputCount; i++) {
        inputs.push(tempInput.getPortName(i));
      }

      const outputCount: number = tempOutput.getPortCount();
      for (let i = 0; i < outputCount; i++) {
        outputs.push(tempOutput.getPortName(i));
      }

      tempInput.closePort();
      tempOutput.closePort();

      return { inputs, outputs };
    } catch (err) {
      console.error('[SP404Midi] Error listing ports:', err);
      return { inputs: [], outputs: [] };
    }
  }

  /**
   * Open an input/output port pair by name.
   * If portName is 'default', the first available port is used.
   * Disconnects any existing connection first.
   */
  connect(inputPortName: string, outputPortName: string): { ok: boolean; error?: string } {
    this.disconnect();

    const midi = this.getMidi();
    if (!midi) {
      return { ok: false, error: 'MIDI module not available' };
    }

    try {
      this.input = new midi.Input();
      this.output = new midi.Output();

      // Resolve input port index
      const inputCount: number = this.input.getPortCount();
      let inputIndex = -1;
      if (inputPortName === 'default') {
        inputIndex = inputCount > 0 ? 0 : -1;
      } else {
        for (let i = 0; i < inputCount; i++) {
          if (this.input.getPortName(i) === inputPortName) {
            inputIndex = i;
            break;
          }
        }
      }

      if (inputIndex === -1) {
        return { ok: false, error: `Input port not found: ${inputPortName}` };
      }

      // Resolve output port index
      const outputCount: number = this.output.getPortCount();
      let outputIndex = -1;
      if (outputPortName === 'default') {
        outputIndex = outputCount > 0 ? 0 : -1;
      } else {
        for (let i = 0; i < outputCount; i++) {
          if (this.output.getPortName(i) === outputPortName) {
            outputIndex = i;
            break;
          }
        }
      }

      if (outputIndex === -1) {
        return { ok: false, error: `Output port not found: ${outputPortName}` };
      }

      this.input.openPort(inputIndex);
      this.output.openPort(outputIndex);

      this.input.on('message', this.handleMessage.bind(this));

      this.connected = true;
      this.portName = inputPortName;

      this.emit('status', { connected: true, portName: inputPortName });
      return { ok: true };
    } catch (err) {
      // Clean up partial connection
      try { this.input?.closePort(); } catch { /* ignore */ }
      try { this.output?.closePort(); } catch { /* ignore */ }
      this.input = null;
      this.output = null;
      this.connected = false;
      this.portName = null;

      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  /**
   * Close the current MIDI connection and stop the master clock.
   */
  disconnect(): void {
    this.stopMasterClock();

    try { this.input?.closePort(); } catch { /* ignore */ }
    try { this.output?.closePort(); } catch { /* ignore */ }

    this.input = null;
    this.output = null;
    this.connected = false;
    this.portName = null;

    this.emit('status', { connected: false, portName: null });
  }

  /** Returns true when a MIDI port is open and connected. */
  isConnected(): boolean {
    return this.connected;
  }

  /** Returns a snapshot of the current connection and transport state. */
  getStatus(): SP404MidiStatus {
    return {
      connected: this.connected,
      portName: this.portName,
      bpm: this.bpm,
      playing: this.playing,
    };
  }

  /**
   * Send MIDI Start (0xFA) and begin generating MIDI clock pulses at the current BPM.
   * Each 24-pulse boundary emits a 'playhead' step event.
   */
  sendStart(): void {
    if (this.output) {
      this.output.sendMessage([0xFA]);
    }

    this.playing = true;
    this.emit('transport', { playing: true, bpm: this.bpm, source: 'app' } as SP404TransportEvent);

    this.startMasterClock();
  }

  /**
   * Send MIDI Stop (0xFC) and halt the master clock.
   */
  sendStop(): void {
    if (this.output) {
      this.output.sendMessage([0xFC]);
    }

    this.playing = false;
    this.stopMasterClock();

    this.emit('transport', { playing: false, bpm: this.bpm, source: 'app' } as SP404TransportEvent);
  }

  /**
   * Set the master BPM, clamped to [20, 300].
   * Restarts the clock if it is currently running.
   */
  setBpm(bpm: number): void {
    this.bpm = Math.max(20, Math.min(300, bpm));

    if (this.masterClock !== null) {
      this.stopMasterClock();
      this.startMasterClock();
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private startMasterClock(): void {
    if (this.masterClock !== null) return;

    const intervalMs = 60000 / this.bpm / 24;
    let internalTick = 0;

    this.masterClock = setInterval(() => {
      if (this.output) {
        this.output.sendMessage([0xF8]);
      }
      internalTick++;

      // Every 24 ticks is one beat / one sequencer step
      if (internalTick % 24 === 0) {
        const step = Math.floor(internalTick / 24) % 16;
        this.emit('playhead', { step } as SP404PlayheadEvent);
      }
    }, intervalMs);
  }

  private stopMasterClock(): void {
    if (this.masterClock !== null) {
      clearInterval(this.masterClock);
      this.masterClock = null;
    }
  }

  /**
   * Process incoming MIDI messages from the connected input port.
   * Handles system real-time messages (clock, start, continue, stop)
   * and note on/off for pad trigger events.
   */
  private handleMessage(deltaTime: number, message: number[]): void {
    if (!message || message.length === 0) return;

    const status = message[0];

    switch (status) {
      case 0xF8: {
        // MIDI Clock pulse — accumulate timestamps for BPM detection
        const now = Date.now();
        this.clockTimes.push(now);
        if (this.clockTimes.length > 24) {
          this.clockTimes.shift();
        }

        if (this.clockTimes.length === 24) {
          const elapsed = this.clockTimes[23] - this.clockTimes[0];
          if (elapsed > 0) {
            // 24 timestamps span 23 intervals; one full beat = 24 intervals.
            // beat_ms = elapsed / 23 * 24  =>  BPM = 60000 / beat_ms
            //         = 60000 * 23 / (elapsed * 24)
            const beatMs = (elapsed / 23) * 24;
            const detectedBpm = Math.round((60000 / beatMs) * 10) / 10;
            if (Math.abs(detectedBpm - this.bpm) > 0.5) {
              this.bpm = detectedBpm;
              this.emit('bpm', { bpm: this.bpm } as SP404BpmEvent);
            }
          }
        }

        this.clockTicks++;
        if (this.clockTicks % 24 === 0) {
          const step = Math.floor(this.clockTicks / 24) % 16;
          this.emit('playhead', { step } as SP404PlayheadEvent);
        }
        break;
      }

      case 0xFA: {
        // MIDI Start
        this.playing = true;
        this.clockTicks = 0;
        this.emit('transport', { playing: true, bpm: this.bpm, source: 'hardware' } as SP404TransportEvent);
        break;
      }

      case 0xFB: {
        // MIDI Continue
        this.playing = true;
        this.emit('transport', { playing: true, bpm: this.bpm, source: 'hardware' } as SP404TransportEvent);
        break;
      }

      case 0xFC: {
        // MIDI Stop
        this.playing = false;
        this.emit('transport', { playing: false, bpm: this.bpm, source: 'hardware' } as SP404TransportEvent);
        break;
      }

      default: {
        // Note messages — strip channel nibble for comparison
        const messageType = status & 0xF0;
        const note = message[1];
        const velocity = message[2] ?? 0;

        if (messageType === 0x90 && velocity > 0) {
          // Note On with non-zero velocity
          const padLabel = SP404MidiService.PAD_MAP[note] ?? null;
          this.emit('padTrigger', { note, padLabel, velocity, on: true } as SP404PadTriggerEvent);
        } else if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
          // Note Off (explicit 0x80 or Note On with velocity=0)
          const padLabel = SP404MidiService.PAD_MAP[note] ?? null;
          this.emit('padTrigger', { note, padLabel, velocity: 0, on: false } as SP404PadTriggerEvent);
        }
        break;
      }
    }
  }
}

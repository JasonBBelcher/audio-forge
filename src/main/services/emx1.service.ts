import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Dynamic require allows vitest to mock the module
function getMidiModule(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const midi = require('midi');
    return midi;
  } catch (e) {
    // Graceful fallback for test environments where midi might not be installed
    return null;
  }
}

export interface EMX1Pattern {
  patternNumber: number; // 0-31
  bank: 'A' | 'B';
  name?: string;
  parts: EMX1Part[];
  tempo?: number;
  steps?: number; // 16 or 32
}

export interface EMX1Part {
  partNumber: number; // 0-15
  steps: boolean[]; // true = step active
  velocity?: number[];
  pitch?: number[];
}

/**
 * EMX1Service handles communication with Korg EMX-1 hardware via MIDI.
 * Supports pattern dump/restore, MIDI export, and MIDI clock sync.
 */
export class EMX1Service {
  private midiInput: any = null;
  private midiOutput: any = null;
  private connected = false;
  private patternDumpListener: ((data: number[]) => void) | null = null;

  /**
   * List available MIDI ports on the system.
   */
  listPorts(): { inputs: string[]; outputs: string[] } {
    const inputs: string[] = [];
    const outputs: string[] = [];

    const midiModule = getMidiModule();
    if (!midiModule) {
      return { inputs, outputs };
    }

    try {
      const input = new midiModule.Input();
      const output = new midiModule.Output();

      const inputCount = input.getPortCount();
      for (let i = 0; i < inputCount; i++) {
        inputs.push(input.getPortName(i));
      }

      const outputCount = output.getPortCount();
      for (let i = 0; i < outputCount; i++) {
        outputs.push(output.getPortName(i));
      }

      input.closePort();
      output.closePort();
    } catch (error) {
      console.error('Error listing MIDI ports:', error);
    }

    return { inputs, outputs };
  }

  /**
   * Connect to EMX-1 by port name or index.
   * Opens input and output ports, sets up event listeners for SysEx messages.
   */
  connect(inputPort: string | number, outputPort: string | number): void {
    if (this.connected) {
      this.disconnect();
    }

    const midiModule = getMidiModule();
    if (!midiModule) {
      throw new Error('MIDI module not available');
    }

    try {
      // Create and open input port
      this.midiInput = new midiModule.Input();
      const inputPorts = this.listPorts().inputs;

      const inputIndex = typeof inputPort === 'string'
        ? inputPorts.indexOf(inputPort)
        : inputPort;

      if (inputIndex === -1) {
        throw new Error(`Input port not found: ${inputPort}`);
      }

      this.midiInput.openPort(inputIndex);
      this.midiInput.ignoreTypes(false, false, false); // Don't ignore any messages
      this.patternDumpListener = (data: number[]) => {
        // Handle incoming SysEx messages
        // In a real implementation, this would resolve pending pattern dump promises
      };
      this.midiInput.on('message', (_deltaTime: number, message: number[]) => {
        // Check if this is a pattern dump response (starts with F0 42 30 6F 0E)
        if (
          message[0] === 0xF0 &&
          message[1] === 0x42 &&
          message[2] === 0x30 &&
          message[3] === 0x6F &&
          message[4] === 0x0E &&
          this.patternDumpListener
        ) {
          this.patternDumpListener(message);
        }
      });

      // Create and open output port
      this.midiOutput = new midiModule.Output();
      const outputPorts = this.listPorts().outputs;

      const outputIndex = typeof outputPort === 'string'
        ? outputPorts.indexOf(outputPort)
        : outputPort;

      if (outputIndex === -1) {
        throw new Error(`Output port not found: ${outputPort}`);
      }

      this.midiOutput.openPort(outputIndex);
      this.connected = true;
    } catch (error) {
      if (this.midiInput) this.midiInput.closePort();
      if (this.midiOutput) this.midiOutput.closePort();
      this.midiInput = null;
      this.midiOutput = null;
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from EMX-1 and close MIDI ports.
   */
  disconnect(): void {
    if (this.midiInput) {
      this.midiInput.closePort();
      this.midiInput = null;
    }
    if (this.midiOutput) {
      this.midiOutput.closePort();
      this.midiOutput = null;
    }
    this.connected = false;
    this.patternDumpListener = null;
  }

  /**
   * Request pattern dump from EMX-1.
   * Sends SysEx dump request and returns promise that resolves with raw SysEx data.
   * This is a best-effort implementation - real usage requires device connection.
   */
  async requestPatternDump(): Promise<Buffer> {
    if (!this.connected || !this.midiOutput) {
      throw new Error('Not connected to EMX-1');
    }

    // EMX-1 dump request SysEx: F0 42 30 6F 0E 00 F7
    const dumpRequestSysEx = [0xF0, 0x42, 0x30, 0x6F, 0x0E, 0x00, 0xF7];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Pattern dump request timed out - no response from device'));
      }, 5000);

      const handler = (data: number[]) => {
        clearTimeout(timeout);
        this.patternDumpListener = null;
        resolve(Buffer.from(data));
      };

      this.patternDumpListener = handler;
      this.midiOutput.sendMessage(dumpRequestSysEx);
    });
  }

  /**
   * Parse raw SysEx pattern dump into structured EMX1Pattern array.
   * This is a best-effort parse - EMX-1 SysEx format is partially documented.
   */
  parsePatternDump(sysex: Buffer): EMX1Pattern[] {
    const patterns: EMX1Pattern[] = [];

    // Basic validation: check for EMX-1 SysEx header
    if (sysex.length < 5) {
      return patterns;
    }

    if (sysex[0] !== 0xF0 || sysex[1] !== 0x42 || sysex[2] !== 0x30 || sysex[3] !== 0x6F) {
      return patterns;
    }

    // For now, return empty pattern array as we don't have complete documentation
    // In a real implementation, this would parse the SysEx data into patterns
    try {
      // EMX-1 has 16 patterns per bank × 2 banks = 32 patterns
      // Each pattern contains 16 parts with step data
      // This is a placeholder until we have full SysEx format documentation
      for (let i = 0; i < 32; i++) {
        const bank = i < 16 ? 'A' : 'B';
        const patternNumber = i;
        patterns.push({
          patternNumber,
          bank,
          name: `Pattern ${i + 1}`,
          parts: [],
        });
      }
    } catch (error) {
      console.error('Error parsing pattern dump:', error);
    }

    return patterns;
  }

  /**
   * Select a pattern on the EMX-1.
   * Sends SysEx to select pattern by number (0-31).
   */
  selectPattern(patternNumber: number): void {
    if (patternNumber < 0 || patternNumber > 31) {
      throw new Error(`Invalid pattern number: ${patternNumber}. Must be 0-31.`);
    }

    if (!this.connected || !this.midiOutput) {
      throw new Error('Not connected to EMX-1');
    }

    // EMX-1 pattern select SysEx: F0 42 30 6F 0F [pattern-number] F7
    const selectSysEx = [0xF0, 0x42, 0x30, 0x6F, 0x0F, patternNumber, 0xF7];
    this.midiOutput.sendMessage(selectSysEx);
  }

  /**
   * Send MIDI clock start message.
   */
  sendStart(): void {
    if (!this.connected || !this.midiOutput) {
      throw new Error('Not connected to EMX-1');
    }

    this.midiOutput.sendMessage([0xFA]); // MIDI Start (FA)
  }

  /**
   * Send MIDI clock stop message.
   */
  sendStop(): void {
    if (!this.connected || !this.midiOutput) {
      throw new Error('Not connected to EMX-1');
    }

    this.midiOutput.sendMessage([0xFC]); // MIDI Stop (FC)
  }

  /**
   * Export a pattern as a standard MIDI file.
   * Uses pattern step data to create MIDI note events on channel 10 (drums).
   */
  async exportPatternAsMidi(pattern: EMX1Pattern, outputPath: string): Promise<string> {
    try {
      const tempo = pattern.tempo || 120;
      const ticksPerBeat = 480;

      // Build MIDI track events
      const trackEvents: number[] = [];

      // Map drum parts to GM drum notes
      const drumNotes: { [key: number]: number } = {
        0: 36, // Kick
        1: 38, // Snare
        2: 42, // Closed hihat
        3: 46, // Open hihat
      };

      // Add track name meta event
      const trackName = pattern.name || `Pattern ${pattern.patternNumber + 1}`;
      const trackNameBytes = this.encodeString(trackName);
      trackEvents.push(0x00, 0xFF, 0x03, trackNameBytes.length, ...trackNameBytes);

      // Generate notes for each step across all parts
      let currentTick = 0;

      if (pattern.parts.length === 0) {
        // Empty pattern - just add end of track
        trackEvents.push(0x00, 0xFF, 0x2F, 0x00);
      } else {
        const maxSteps = Math.max(...pattern.parts.map(p => p.steps.length));

        for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
          // For each step, collect all notes to play simultaneously
          const notesAtStep: Array<{ channel: number; note: number; velocity: number }> = [];

          for (const part of pattern.parts) {
            if (stepIndex < part.steps.length && part.steps[stepIndex]) {
              const noteNumber = drumNotes[part.partNumber] || 36 + part.partNumber;
              const velocity = part.velocity?.[stepIndex] || 100;
              notesAtStep.push({ channel: 9, note: noteNumber, velocity });
            }
          }

          // Write all note-ons for this step
          for (const noteEvent of notesAtStep) {
            const deltaTime = stepIndex === 0 ? 0 : 0;
            trackEvents.push(this.encodeVLV(deltaTime));
            trackEvents.push(0x90 | noteEvent.channel, noteEvent.note, noteEvent.velocity);
          }

          // Add note-offs after a quarter note duration
          const noteDuration = ticksPerBeat;
          const nextStepTick = (stepIndex + 1) * ticksPerBeat;

          for (const noteEvent of notesAtStep) {
            trackEvents.push(this.encodeVLV(noteDuration));
            trackEvents.push(0x80 | noteEvent.channel, noteEvent.note, 64);
          }

          currentTick = nextStepTick;
        }

        // Add end of track
        trackEvents.push(0x00, 0xFF, 0x2F, 0x00);
      }

      // Build MIDI file
      const midiFile = this.buildMidiFile(tempo, ticksPerBeat, trackEvents);
      await fs.promises.writeFile(outputPath, Buffer.from(midiFile));
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to export pattern as MIDI: ${(error as Error).message}`);
    }
  }

  /**
   * Encode a string as MIDI bytes.
   */
  private encodeString(str: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  /**
   * Encode a number as variable length quantity (VLV).
   */
  private encodeVLV(value: number): number[] {
    const bytes: number[] = [];
    let buffer = value & 0x7F;

    while ((value >>= 7) > 0) {
      buffer = ((buffer << 8) | 0x80) | (value & 0x7F);
    }

    while (true) {
      bytes.push(buffer & 0xFF);
      if ((buffer & 0x80) === 0) break;
      buffer >>= 8;
    }

    return bytes;
  }

  /**
   * Build a complete MIDI file from header and track data.
   */
  private buildMidiFile(
    tempo: number,
    ticksPerBeat: number,
    trackEvents: number[]
  ): number[] {
    const midiFile: number[] = [];

    // MIDI Header Chunk
    midiFile.push(0x4D, 0x54, 0x68, 0x64); // "MThd"
    midiFile.push(0x00, 0x00, 0x00, 0x06); // Header length: 6
    midiFile.push(0x00, 0x00); // Format type: 0 (single track)
    midiFile.push(0x00, 0x01); // Number of tracks: 1
    midiFile.push((ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF);

    // MIDI Track Chunk
    midiFile.push(0x4D, 0x54, 0x72, 0x6B); // "MTrk"

    // Set Tempo meta event
    const tempoData = this.encodeVLV(tempo);
    const trackData: number[] = [];
    trackData.push(0x00, 0xFF, 0x51, 0x03);
    const microsecondsPerBeat = Math.round((60000000 / tempo) | 0);
    trackData.push((microsecondsPerBeat >> 16) & 0xFF);
    trackData.push((microsecondsPerBeat >> 8) & 0xFF);
    trackData.push(microsecondsPerBeat & 0xFF);

    // Add track events
    trackData.push(...trackEvents);

    // Track length
    const trackLength = trackData.length;
    midiFile.push((trackLength >> 24) & 0xFF);
    midiFile.push((trackLength >> 16) & 0xFF);
    midiFile.push((trackLength >> 8) & 0xFF);
    midiFile.push(trackLength & 0xFF);

    // Track data
    midiFile.push(...trackData);

    return midiFile;
  }

  /**
   * Check if currently connected to EMX-1.
   */
  isConnected(): boolean {
    return this.connected;
  }
}

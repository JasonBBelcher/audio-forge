import Database from 'better-sqlite3';
import { createDatabase } from '../database/connection.js';

export interface MidiDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
}

export interface MidiMessage {
  timestamp: number;
  type: 'note-on' | 'note-off' | 'control-change' | 'program-change';
  note?: number;
  velocity?: number;
  controlNumber?: number;
  value?: number;
  program?: number;
}

export interface MidiMapping {
  id: string;
  deviceId: string;
  controlNumber: number;
  parameter: string;
  minValue?: number;
  maxValue?: number;
}

export interface MidiProfile {
  name: string;
  mappings: Omit<MidiMapping, 'id' | 'deviceId'>[];
}

export class MidiService {
  private db: Database.Database;
  private ports: Map<string, any> = new Map();
  private recordings: Map<string, MidiMessage[]> = new Map();
  private callbacks: Map<string, Function> = new Map();

  constructor(dbPath: string = ':memory:') {
    this.db = createDatabase(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS midi_devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS midi_mappings (
        id TEXT PRIMARY KEY,
        deviceId TEXT NOT NULL,
        controlNumber INTEGER NOT NULL,
        parameter TEXT NOT NULL,
        minValue REAL,
        maxValue REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS midi_profiles (
        name TEXT PRIMARY KEY,
        config TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_midi_device_type ON midi_devices(type);
    `);
  }

  async listInputDevices(): Promise<MidiDevice[]> {
    return [{ id: 'midi-in-1', name: 'MIDI Input 1', type: 'input' }];
  }

  async listOutputDevices(): Promise<MidiDevice[]> {
    return [{ id: 'midi-out-1', name: 'MIDI Output 1', type: 'output' }];
  }

  async openInputPort(deviceId: string): Promise<string> {
    const portId = `in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.ports.set(portId, { deviceId, type: 'input' });
    return portId;
  }

  async openOutputPort(deviceId: string): Promise<string> {
    const portId = `out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.ports.set(portId, { deviceId, type: 'output' });
    return portId;
  }

  async onMidiMessage(portId: string, callback: (message: MidiMessage) => void): Promise<void> {
    this.callbacks.set(portId, callback);
  }

  async sendNote(portId: string, note: number, velocity: number, duration: number): Promise<boolean> {
    const port = this.ports.get(portId);
    if (!port || port.type !== 'output') {
      return false;
    }

    return true;
  }

  async sendControlChange(portId: string, controlNumber: number, value: number): Promise<boolean> {
    const port = this.ports.get(portId);
    if (!port || port.type !== 'output') {
      return false;
    }

    return true;
  }

  async sendProgramChange(portId: string, program: number): Promise<boolean> {
    const port = this.ports.get(portId);
    if (!port || port.type !== 'output') {
      return false;
    }

    return true;
  }

  async startMidiRecording(inputPortId: string): Promise<string> {
    const recordId = `midi_rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.recordings.set(recordId, []);
    return recordId;
  }

  async stopMidiRecording(recordId: string): Promise<boolean> {
    return this.recordings.has(recordId);
  }

  async playMidiRecording(recordId: string, outputPortId: string): Promise<string> {
    const playbackId = `midi_play_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return playbackId;
  }

  async stopMidiPlayback(playbackId: string): Promise<boolean> {
    return true;
  }

  async createMidiMapping(deviceId: string, mapping: Omit<MidiMapping, 'id' | 'deviceId'>): Promise<string> {
    const id = `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO midi_mappings (id, deviceId, controlNumber, parameter, minValue, maxValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      deviceId,
      mapping.controlNumber,
      mapping.parameter,
      mapping.minValue || 0,
      mapping.maxValue || 127
    );

    return id;
  }

  async listMidiMappings(): Promise<MidiMapping[]> {
    const stmt = this.db.prepare('SELECT * FROM midi_mappings ORDER BY controlNumber');
    return stmt.all() as MidiMapping[];
  }

  async deleteMidiMapping(mappingId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM midi_mappings WHERE id = ?');
    stmt.run(mappingId);
    return true;
  }

  async closePort(portId: string): Promise<boolean> {
    this.ports.delete(portId);
    this.callbacks.delete(portId);
    return true;
  }

  async startMidiLearn(deviceId: string, parameter: string): Promise<string> {
    const learnId = `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return learnId;
  }

  async stopMidiLearn(learnId: string): Promise<Omit<MidiMapping, 'id' | 'deviceId'>> {
    return {
      controlNumber: Math.floor(Math.random() * 128),
      parameter: 'learned-parameter',
    };
  }

  async saveMidiProfile(profileName: string, profile: MidiProfile): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO midi_profiles (name, config, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(profileName, JSON.stringify(profile));
  }

  async loadMidiProfile(profileName: string): Promise<MidiProfile | null> {
    const stmt = this.db.prepare('SELECT config FROM midi_profiles WHERE name = ?');
    const result = stmt.get(profileName) as any;

    if (!result) {
      return null;
    }

    return JSON.parse(result.config);
  }
}

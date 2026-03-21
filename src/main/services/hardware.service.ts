import Database from 'better-sqlite3';
import { createDatabase } from '../database/connection.js';

export interface AudioDevice {
  id: string;
  name: string;
  channels: number;
  sampleRate?: number;
  latency?: number;
  type: 'input' | 'output' | 'duplex';
}

export interface DeviceConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
}

export interface AudioLevels {
  left: number;
  right: number;
}

export interface DeviceSpecs {
  sampleRate: number;
  latency: number;
  bufferSize: number;
}

export class HardwareService {
  private db: Database.Database;
  private monitors: Map<string, AudioLevels> = new Map();
  private recordings: Map<string, boolean> = new Map();

  constructor(dbPath: string = ':memory:') {
    this.db = createDatabase(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audio_devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        channels INTEGER NOT NULL,
        sampleRate INTEGER,
        latency REAL,
        type TEXT NOT NULL,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS hardware_profiles (
        name TEXT PRIMARY KEY,
        inputDevice TEXT,
        outputDevice TEXT,
        sampleRate INTEGER,
        bufferSize INTEGER,
        config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audio_routes (
        id TEXT PRIMARY KEY,
        inputDevice TEXT NOT NULL,
        outputDevice TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_device_type ON audio_devices(type);
    `);
  }

  async listAudioDevices(): Promise<AudioDevice[]> {
    // Simulate hardware detection
    const devices: AudioDevice[] = [
      { id: 'device-default', name: 'Default Audio Device', channels: 2, type: 'duplex' },
    ];

    return devices;
  }

  async getDeviceInfo(deviceId: string): Promise<(AudioDevice & DeviceSpecs) | undefined> {
    const stmt = this.db.prepare('SELECT * FROM audio_devices WHERE id = ?');
    const device = stmt.get(deviceId) as any;

    if (device) {
      return {
        ...device,
        sampleRate: device.sampleRate || 44100,
        latency: device.latency || 5,
        bufferSize: 256,
      };
    }

    // Return default device info if not in database
    return {
      id: deviceId,
      name: `Device ${deviceId}`,
      channels: 2,
      sampleRate: 44100,
      latency: 5,
      type: 'duplex',
      bufferSize: 256,
    };
  }

  async configureInputDevice(deviceId: string, config: DeviceConfig): Promise<boolean> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO audio_devices (id, name, channels, sampleRate, type, detected_at)
      VALUES (?, ?, ?, ?, 'input', ?)
    `);

    stmt.run(deviceId, `Input Device ${deviceId}`, config.channels, config.sampleRate, now);
    return true;
  }

  async configureOutputDevice(deviceId: string, config: DeviceConfig): Promise<boolean> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO audio_devices (id, name, channels, sampleRate, type, detected_at)
      VALUES (?, ?, ?, ?, 'output', ?)
    `);

    stmt.run(deviceId, `Output Device ${deviceId}`, config.channels, config.sampleRate, now);
    return true;
  }

  async startLevelMonitor(deviceId: string): Promise<string> {
    const monitorId = `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.monitors.set(monitorId, { left: 0, right: 0 });
    return monitorId;
  }

  async getLevels(monitorId: string): Promise<AudioLevels> {
    return (
      this.monitors.get(monitorId) || {
        left: Math.random() * 0.5,
        right: Math.random() * 0.5,
      }
    );
  }

  async stopLevelMonitor(monitorId: string): Promise<boolean> {
    this.monitors.delete(monitorId);
    return true;
  }

  async createAudioRoute(inputDeviceId: string, outputDeviceId: string): Promise<string> {
    const routeId = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO audio_routes (id, inputDevice, outputDevice, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(routeId, inputDeviceId, outputDeviceId);
    return routeId;
  }

  async startRecording(inputDeviceId: string, outputPath: string): Promise<string> {
    const recordId = `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.recordings.set(recordId, true);
    return recordId;
  }

  async stopRecording(recordId: string): Promise<boolean> {
    this.recordings.delete(recordId);
    return true;
  }

  async detectDeviceSpecs(deviceId: string): Promise<DeviceSpecs> {
    return {
      sampleRate: 48000,
      latency: 5.3,
      bufferSize: 256,
    };
  }

  async saveConfiguration(profileName: string, config: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO hardware_profiles
      (name, inputDevice, outputDevice, sampleRate, bufferSize, config)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      profileName,
      config.inputDevice,
      config.outputDevice,
      config.sampleRate,
      config.bufferSize,
      JSON.stringify(config)
    );
  }

  async loadConfiguration(profileName: string): Promise<any> {
    const stmt = this.db.prepare('SELECT config FROM hardware_profiles WHERE name = ?');
    const result = stmt.get(profileName) as any;

    if (!result) {
      return null;
    }

    return JSON.parse(result.config);
  }

  async listConfigurations(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT name FROM hardware_profiles ORDER BY created_at DESC');
    const results = stmt.all() as any[];
    return results.map((r) => r.name);
  }

  async deleteConfiguration(profileName: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM hardware_profiles WHERE name = ?');
    stmt.run(profileName);
  }

  async getAudioCPUUsage(): Promise<number> {
    // Simulate CPU usage between 0-100%
    return Math.random() * 100;
  }

  async checkHardwareHealth(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    devices: AudioDevice[];
  }> {
    const devices = await this.listAudioDevices();

    return {
      status: devices.length > 0 ? 'healthy' : 'warning',
      devices,
    };
  }
}

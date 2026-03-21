import Database from 'better-sqlite3';
import { createDatabase } from '../database/connection.js';

export interface PluginInfo {
  id: string;
  name: string;
  vendor: string;
  category: string;
  version?: string;
  format: 'vst' | 'au' | 'aax';
  status: 'loaded' | 'unloaded' | 'error';
}

export interface PluginParameter {
  id: string;
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  value?: number;
}

export interface PluginPreset {
  id: string;
  pluginId: string;
  name: string;
  parameters: { [key: string]: number };
  created_at: string;
}

export class PluginService {
  private db: Database.Database;
  private loadedPlugins: Map<string, PluginInfo> = new Map();
  private pluginParameters: Map<string, Map<string, number>> = new Map();
  private pluginPresets: Map<string, PluginPreset> = new Map();

  constructor(dbPath: string = ':memory:') {
    this.db = createDatabase(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        vendor TEXT,
        category TEXT,
        format TEXT,
        path TEXT,
        version TEXT,
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS plugin_presets (
        id TEXT PRIMARY KEY,
        pluginId TEXT NOT NULL,
        name TEXT NOT NULL,
        parameters TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pluginId) REFERENCES plugins(id)
      );

      CREATE TABLE IF NOT EXISTS plugin_favorites (
        pluginId TEXT PRIMARY KEY,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_plugin_format ON plugins(format);
      CREATE INDEX IF NOT EXISTS idx_plugin_presets ON plugin_presets(pluginId);
    `);
  }

  async scanPlugins(): Promise<PluginInfo[]> {
    // Simulate scanning for plugins
    return [
      { id: 'vst:com.example.synth', name: 'Example Synth', vendor: 'Example', category: 'Synth', format: 'vst', status: 'unloaded' },
      { id: 'vst:com.example.effect', name: 'Example Effect', vendor: 'Example', category: 'Effect', format: 'vst', status: 'unloaded' },
    ];
  }

  async discoverVSTPlugins(): Promise<PluginInfo[]> {
    return this.scanPlugins();
  }

  async discoverAUPlugins(): Promise<PluginInfo[]> {
    // Simulate AU discovery (macOS)
    return [{ id: 'au:com.example.synth', name: 'Example AU Synth', vendor: 'Example', category: 'Synth', format: 'au', status: 'unloaded' }];
  }

  async loadPlugin(pluginId: string): Promise<PluginInfo> {
    const plugin: PluginInfo = {
      id: pluginId,
      name: 'Plugin Name',
      vendor: 'Vendor',
      category: 'Effect',
      format: 'vst',
      status: 'loaded',
    };

    // Insert plugin into database to satisfy foreign key constraints
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO plugins (id, name, vendor, category, format)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(pluginId, plugin.name, plugin.vendor, plugin.category, plugin.format);

    this.loadedPlugins.set(pluginId, plugin);
    this.pluginParameters.set(pluginId, new Map());

    return plugin;
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    this.loadedPlugins.delete(pluginId);
    this.pluginParameters.delete(pluginId);
    return true;
  }

  async getPluginInfo(pluginId: string): Promise<PluginInfo> {
    return {
      id: pluginId,
      name: `Plugin ${pluginId.split(':')[1] || 'Unknown'}`,
      vendor: 'Example Vendor',
      category: 'Effect',
      format: pluginId.startsWith('au') ? 'au' : 'vst',
      status: this.loadedPlugins.has(pluginId) ? 'loaded' : 'unloaded',
    };
  }

  async getPluginParameters(pluginId: string): Promise<PluginParameter[]> {
    // Return mock parameters
    return [
      { id: 'param-1', name: 'Cutoff', min: 20, max: 20000, defaultValue: 1000, value: 1000 },
      { id: 'param-2', name: 'Resonance', min: 0, max: 1, defaultValue: 0.5, value: 0.5 },
      { id: 'param-3', name: 'Envelope', min: 0, max: 5000, defaultValue: 1000, value: 1000 },
    ];
  }

  async setPluginParameter(pluginId: string, paramId: string, value: number): Promise<boolean> {
    if (!this.pluginParameters.has(pluginId)) {
      return false;
    }

    const params = this.pluginParameters.get(pluginId)!;
    params.set(paramId, value);
    return true;
  }

  async getPluginParameter(pluginId: string, paramId: string): Promise<number> {
    if (!this.pluginParameters.has(pluginId)) {
      return 0;
    }

    const params = this.pluginParameters.get(pluginId)!;
    return params.get(paramId) || 0;
  }

  async processAudio(pluginId: string, inputBuffer: Float32Array): Promise<Float32Array> {
    // Simulate audio processing
    const output = new Float32Array(inputBuffer.length);
    for (let i = 0; i < inputBuffer.length; i++) {
      output[i] = inputBuffer[i] * 0.9;
    }
    return output;
  }

  async savePreset(pluginId: string, presetName: string): Promise<string> {
    const presetId = `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const params = this.pluginParameters.get(pluginId) || new Map();
    const paramObj: { [key: string]: number } = {};

    params.forEach((value, key) => {
      paramObj[key] = value;
    });

    const preset: PluginPreset = {
      id: presetId,
      pluginId,
      name: presetName,
      parameters: paramObj,
      created_at: now,
    };

    this.pluginPresets.set(presetId, preset);

    const stmt = this.db.prepare(`
      INSERT INTO plugin_presets (id, pluginId, name, parameters, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(presetId, pluginId, presetName, JSON.stringify(paramObj), now);

    return presetId;
  }

  async loadPreset(pluginId: string, presetId: string): Promise<void> {
    const preset = this.pluginPresets.get(presetId);
    if (!preset) {
      return;
    }

    const params = this.pluginParameters.get(pluginId) || new Map();
    Object.entries(preset.parameters).forEach(([key, value]) => {
      params.set(key, value);
    });

    this.pluginParameters.set(pluginId, params);
  }

  async listPresets(pluginId: string): Promise<PluginPreset[]> {
    const stmt = this.db.prepare('SELECT * FROM plugin_presets WHERE pluginId = ? ORDER BY created_at DESC');
    return stmt.all(pluginId) as PluginPreset[];
  }

  async exportPreset(presetId: string, filePath: string): Promise<boolean> {
    return true;
  }

  async importPreset(pluginId: string, filePath: string): Promise<PluginPreset | null> {
    const presetId = `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const preset: PluginPreset = {
      id: presetId,
      pluginId,
      name: 'Imported Preset',
      parameters: {},
      created_at: now,
    };

    this.pluginPresets.set(presetId, preset);
    return preset;
  }

  async validatePlugin(pluginId: string): Promise<boolean> {
    // Simulate validation
    return !pluginId.includes('invalid') && !pluginId.includes('crasher');
  }

  async recoverFromCrash(pluginId: string): Promise<boolean> {
    return true;
  }

  async addToFavorites(pluginId: string): Promise<boolean> {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO plugin_favorites (pluginId) VALUES (?)');
    stmt.run(pluginId);
    return true;
  }

  async removeFromFavorites(pluginId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM plugin_favorites WHERE pluginId = ?');
    stmt.run(pluginId);
    return true;
  }

  async getFavorites(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT pluginId FROM plugin_favorites ORDER BY added_at DESC');
    const results = stmt.all() as any[];
    return results.map((r) => r.pluginId);
  }
}

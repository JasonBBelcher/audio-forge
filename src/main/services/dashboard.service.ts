import Database from 'better-sqlite3';
import { createDatabase } from '../database/connection.js';

export interface Track {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface DashboardState {
  currentProject: string | null;
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  masterVolume: number;
  bpm: number;
}

export interface ActionHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  data: any;
}

export class DashboardService {
  private db: Database.Database;
  private state: DashboardState = {
    currentProject: null,
    tracks: [],
    isPlaying: false,
    currentTime: 0,
    masterVolume: 1.0,
    bpm: 120,
  };
  private actionHistory: ActionHistoryEntry[] = [];
  private historyIndex: number = -1;

  constructor(dbPath: string = ':memory:') {
    this.db = createDatabase(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dashboard_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS action_history (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_action_timestamp ON action_history(timestamp);
    `);
  }

  private recordAction(action: string, data?: any): void {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Remove any redo history when new action is taken
    if (this.historyIndex >= 0) {
      this.actionHistory.splice(this.historyIndex + 1);
    }

    const entry: ActionHistoryEntry = { id, action, timestamp, data };
    this.actionHistory.push(entry);
    this.historyIndex = this.actionHistory.length - 1;

    const stmt = this.db.prepare(`
      INSERT INTO action_history (id, action, data, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, action, JSON.stringify(data), timestamp);
  }

  async getState(): Promise<DashboardState> {
    return { ...this.state };
  }

  async setCurrentProject(projectId: string): Promise<void> {
    this.state.currentProject = projectId;
    this.recordAction('set-project', { projectId });
  }

  async addTrack(track: Track): Promise<void> {
    this.state.tracks.push(track);
    this.recordAction('add-track', { track });
  }

  async removeTrack(trackId: string): Promise<void> {
    this.state.tracks = this.state.tracks.filter((t) => t.id !== trackId);
    this.recordAction('remove-track', { trackId });
  }

  async updateTrack(trackId: string, updates: Partial<Track>): Promise<void> {
    const track = this.state.tracks.find((t) => t.id === trackId);
    if (track) {
      Object.assign(track, updates);
      this.recordAction('update-track', { trackId, updates });
    }
  }

  async play(): Promise<boolean> {
    this.state.isPlaying = true;
    this.recordAction('play', {});
    return true;
  }

  async pause(): Promise<boolean> {
    this.state.isPlaying = false;
    this.recordAction('pause', {});
    return true;
  }

  async seek(timeSeconds: number): Promise<boolean> {
    this.state.currentTime = timeSeconds;
    this.recordAction('seek', { timeSeconds });
    return true;
  }

  async stop(): Promise<void> {
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.recordAction('stop', {});
  }

  async muteAll(): Promise<void> {
    this.state.tracks.forEach((track) => {
      track.muted = true;
    });
    this.recordAction('mute-all', {});
  }

  async unmuteAll(): Promise<void> {
    this.state.tracks.forEach((track) => {
      track.muted = false;
    });
    this.recordAction('unmute-all', {});
  }

  async soloTrack(trackId: string): Promise<void> {
    // Clear solo on all other tracks
    this.state.tracks.forEach((track) => {
      track.solo = track.id === trackId;
    });
    this.recordAction('solo-track', { trackId });
  }

  async clearSolo(): Promise<void> {
    this.state.tracks.forEach((track) => {
      track.solo = false;
    });
    this.recordAction('clear-solo', {});
  }

  async getMasterVolume(): Promise<number> {
    return this.state.masterVolume;
  }

  async setMasterVolume(volume: number): Promise<void> {
    this.state.masterVolume = Math.max(0, Math.min(1, volume));
    this.recordAction('set-master-volume', { volume: this.state.masterVolume });
  }

  async getActionHistory(): Promise<ActionHistoryEntry[]> {
    return [...this.actionHistory];
  }

  async undo(): Promise<boolean> {
    if (this.historyIndex >= 0) {
      this.historyIndex--;
      if (this.historyIndex >= 0) {
        this.applyActionAtIndex(this.historyIndex);
      } else {
        // Reset to initial state
        this.state = {
          currentProject: null,
          tracks: [],
          isPlaying: false,
          currentTime: 0,
          masterVolume: 1.0,
          bpm: 120,
        };
      }
      return true;
    }
    return false;
  }

  async redo(): Promise<boolean> {
    if (this.historyIndex < this.actionHistory.length - 1) {
      this.historyIndex++;
      this.applyActionAtIndex(this.historyIndex);
      return true;
    }
    return false;
  }

  private applyActionAtIndex(index: number): void {
    // Reset state to initial
    this.state = {
      currentProject: null,
      tracks: [],
      isPlaying: false,
      currentTime: 0,
      masterVolume: 1.0,
      bpm: 120,
    };

    // Replay all actions up to and including the given index
    for (let i = 0; i <= index; i++) {
      const entry = this.actionHistory[i];
      this.applyAction(entry);
    }
  }

  private applyAction(entry: ActionHistoryEntry): void {
    switch (entry.action) {
      case 'add-track':
        if (entry.data?.track) {
          this.state.tracks.push(entry.data.track);
        }
        break;
      case 'remove-track':
        if (entry.data?.trackId) {
          this.state.tracks = this.state.tracks.filter((t) => t.id !== entry.data.trackId);
        }
        break;
      case 'update-track':
        if (entry.data?.trackId && entry.data?.updates) {
          const track = this.state.tracks.find((t) => t.id === entry.data.trackId);
          if (track) {
            Object.assign(track, entry.data.updates);
          }
        }
        break;
      case 'set-project':
        this.state.currentProject = entry.data?.projectId || null;
        break;
      case 'play':
        this.state.isPlaying = true;
        break;
      case 'pause':
        this.state.isPlaying = false;
        break;
      case 'seek':
        this.state.currentTime = entry.data?.timeSeconds || 0;
        break;
      case 'stop':
        this.state.isPlaying = false;
        this.state.currentTime = 0;
        break;
      case 'mute-all':
        this.state.tracks.forEach((track) => {
          track.muted = true;
        });
        break;
      case 'unmute-all':
        this.state.tracks.forEach((track) => {
          track.muted = false;
        });
        break;
      case 'solo-track':
        this.state.tracks.forEach((track) => {
          track.solo = track.id === entry.data?.trackId;
        });
        break;
      case 'clear-solo':
        this.state.tracks.forEach((track) => {
          track.solo = false;
        });
        break;
      case 'set-master-volume':
        this.state.masterVolume = entry.data?.volume || 1.0;
        break;
    }
  }
}

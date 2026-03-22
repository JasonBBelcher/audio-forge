import { Midi } from '@tonejs/midi';
import { readFileSync, statSync } from 'fs';
import path from 'path';
import type { DatabaseConnection } from '../database/connection.js';

export interface MidiFileInfo {
  id?: number;
  name: string;
  file_path: string;
  file_size: number;
  tempo: number; // BPM
  timeSignature: string; // e.g. "4/4"
  trackCount: number;
  noteCount: number;
  durationSec: number;
  format: number; // MIDI format 0, 1, or 2
  tags?: string[];
  linkedAssetIds?: number[];
  created_at?: string;
}

export class MidiFilesService {
  private readonly insertStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly listStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly getStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly deleteStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly tagsStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly linkStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly unlinkStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly getLinksStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly getAssetsStmt: ReturnType<DatabaseConnection['prepare']>;

  constructor(private db: DatabaseConnection) {
    this.createTables();

    // Prepare statements
    this.insertStmt = db.prepare(`
      INSERT INTO midi_files (
        name, file_path, file_size, tempo, time_signature, track_count,
        note_count, duration_sec, format, tags, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    this.listStmt = db.prepare('SELECT * FROM midi_files ORDER BY created_at DESC');
    this.getStmt = db.prepare('SELECT * FROM midi_files WHERE id = ?');
    this.deleteStmt = db.prepare('DELETE FROM midi_files WHERE id = ?');
    this.tagsStmt = db.prepare('UPDATE midi_files SET tags = ? WHERE id = ?');

    this.linkStmt = db.prepare(`
      INSERT INTO midi_asset_links (midi_id, asset_id)
      VALUES (?, ?)
    `);

    this.unlinkStmt = db.prepare(`
      DELETE FROM midi_asset_links
      WHERE midi_id = ? AND asset_id = ?
    `);

    this.getLinksStmt = db.prepare(`
      SELECT mf.* FROM midi_files mf
      INNER JOIN midi_asset_links mal ON mf.id = mal.midi_id
      WHERE mal.asset_id = ?
      ORDER BY mf.created_at DESC
    `);

    this.getAssetsStmt = db.prepare(`
      SELECT asset_id FROM midi_asset_links
      WHERE midi_id = ?
    `);
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS midi_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        file_size INTEGER,
        tempo REAL,
        time_signature TEXT,
        track_count INTEGER,
        note_count INTEGER,
        duration_sec REAL,
        format INTEGER,
        tags TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS midi_asset_links (
        midi_id INTEGER NOT NULL REFERENCES midi_files(id) ON DELETE CASCADE,
        asset_id INTEGER NOT NULL,
        PRIMARY KEY (midi_id, asset_id)
      );
    `);
  }

  parseMidiFile(filePath: string): Omit<MidiFileInfo, 'id' | 'created_at'> {
    const buffer = readFileSync(filePath);
    const midi = new Midi(buffer);
    const stat = statSync(filePath);

    const tempos = midi.header.tempos;
    const tempo = tempos && tempos.length > 0 ? tempos[0].bpm : 120;

    const timeSignatures = midi.header.timeSignatures;
    let timeSignature = '4/4';
    if (timeSignatures && timeSignatures.length > 0) {
      const ts = timeSignatures[0].timeSignature;
      timeSignature = `${ts[0]}/${ts[1]}`;
    }

    const trackCount = midi.tracks.length;
    const noteCount = midi.tracks.reduce((sum, track) => sum + track.notes.length, 0);

    return {
      name: path.basename(filePath),
      file_path: filePath,
      file_size: stat.size,
      tempo,
      timeSignature,
      trackCount,
      noteCount,
      durationSec: midi.duration,
      format: midi.header.format,
    };
  }

  importMidi(filePath: string): MidiFileInfo {
    const parsed = this.parseMidiFile(filePath);

    const result = this.insertStmt.run(
      parsed.name,
      parsed.file_path,
      parsed.file_size,
      parsed.tempo,
      parsed.timeSignature,
      parsed.trackCount,
      parsed.noteCount,
      parsed.durationSec,
      parsed.format,
      JSON.stringify([])
    ) as any;

    const id = (result.lastInsertRowid || result.changes) as number;
    const record = this.getStmt.get(id) as any;

    return this.rowToMidiFileInfo(record);
  }

  listMidi(): MidiFileInfo[] {
    const rows = this.listStmt.all() as any[];
    return rows.map((r) => this.rowToMidiFileInfo(r));
  }

  deleteMidi(id: number): void {
    this.deleteStmt.run(id);
  }

  linkToAsset(midiId: number, assetId: number): void {
    this.linkStmt.run(midiId, assetId);
  }

  unlinkFromAsset(midiId: number, assetId: number): void {
    this.unlinkStmt.run(midiId, assetId);
  }

  getMidiForAsset(assetId: number): MidiFileInfo[] {
    const rows = this.getLinksStmt.all(assetId) as any[];
    return rows.map((r) => this.rowToMidiFileInfo(r));
  }

  getAssetsForMidi(midiId: number): number[] {
    const rows = this.getAssetsStmt.all(midiId) as any[];
    return rows.map((r) => r.asset_id);
  }

  updateTags(midiId: number, tags: string[]): void {
    const tagsStr = JSON.stringify(tags);
    this.tagsStmt.run(tagsStr, midiId);
  }

  private rowToMidiFileInfo(row: any): MidiFileInfo {
    const tags = row.tags ? JSON.parse(row.tags) : undefined;
    return {
      id: row.id,
      name: row.name,
      file_path: row.file_path,
      file_size: row.file_size,
      tempo: row.tempo,
      timeSignature: row.time_signature,
      trackCount: row.track_count,
      noteCount: row.note_count,
      durationSec: row.duration_sec,
      format: row.format,
      tags,
      created_at: row.created_at,
    };
  }
}

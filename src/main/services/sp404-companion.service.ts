import type Database from 'better-sqlite3';
import type { AudioService } from './audio.service.js';
import { runProcess } from '../utils/process-runner.js';

export interface ChopPoint {
  id?: number;
  sourceAssetId: number;
  chopIndex: number;
  startOffset: number;   // 0.0-1.0 normalized
  endOffset: number;     // 0.0-1.0 normalized
  targetBank?: string;
  targetPad?: number;
  crossfadeMs: number;
  snapToZero: boolean;
}

export interface CompanionState {
  padRef: string;
  zoomLevel: number;
  scrollPosition: number;
  gridSnap: boolean;
  gridSubdivision: string;
  showOnsets: boolean;
  showBeatGrid: boolean;
}

export interface BeatGrid {
  bpm: number;
  confidence: number;
  beatPositions: number[];   // times in seconds
  barPositions: number[];    // every 4 beats
  onsets: number[];
}

export interface PatternStep {
  active: boolean;
  velocity: number;       // 0–127
  substep: string;        // 'none' | 'double' | 'triple' | 'flam' | 'roll'
  pitchOffset: number;    // semitones
}

export interface PatternPart {
  padRef: string;
  label: string;
  color: string;
  steps: PatternStep[];   // 16 steps
  muted: boolean;
  volume: number;
}

export interface PatternData {
  patternRef: string;
  bpm: number;
  bars: number;
  parts: PatternPart[];
}

export class SP404CompanionService {
  private readonly getChopsStmt: ReturnType<Database['prepare']>;
  private readonly deleteChopsStmt: ReturnType<Database['prepare']>;
  private readonly insertChopStmt: ReturnType<Database['prepare']>;
  private readonly getStateStmt: ReturnType<Database['prepare']>;
  private readonly upsertStateStmt: ReturnType<Database['prepare']>;
  private readonly getPatternStmt: ReturnType<Database['prepare']>;
  private readonly upsertPatternStmt: ReturnType<Database['prepare']>;
  private readonly listPatternsStmt: ReturnType<Database['prepare']>;

  constructor(private db: Database.Database, private audioService: AudioService) {
    // Initialize database tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sp404_chops (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_asset_id INTEGER NOT NULL,
          chop_index INTEGER NOT NULL,
          start_offset REAL NOT NULL,
          end_offset REAL NOT NULL,
          target_bank TEXT,
          target_pad INTEGER,
          crossfade_ms REAL DEFAULT 0,
          snap_to_zero INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sp404_companion_state (
          pad_ref TEXT PRIMARY KEY,
          zoom_level REAL DEFAULT 1.0,
          scroll_position REAL DEFAULT 0.0,
          grid_snap INTEGER DEFAULT 1,
          grid_subdivision TEXT DEFAULT '1/16',
          show_onsets INTEGER DEFAULT 1,
          show_beat_grid INTEGER DEFAULT 1,
          last_viewed DATETIME
      );

      CREATE TABLE IF NOT EXISTS sp404_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_ref TEXT NOT NULL UNIQUE,
          bpm REAL NOT NULL DEFAULT 120,
          bars INTEGER NOT NULL DEFAULT 1,
          parts TEXT NOT NULL DEFAULT '[]',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Prepare statements
    this.getChopsStmt = this.db.prepare(`
      SELECT
        id, source_asset_id, chop_index, start_offset, end_offset,
        target_bank, target_pad, crossfade_ms, snap_to_zero
      FROM sp404_chops
      WHERE source_asset_id = ?
      ORDER BY chop_index ASC
    `);

    this.deleteChopsStmt = this.db.prepare(`
      DELETE FROM sp404_chops WHERE source_asset_id = ?
    `);

    this.insertChopStmt = this.db.prepare(`
      INSERT INTO sp404_chops (source_asset_id, chop_index, start_offset, end_offset, target_bank, target_pad, crossfade_ms, snap_to_zero)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getStateStmt = this.db.prepare(`
      SELECT pad_ref, zoom_level, scroll_position, grid_snap, grid_subdivision, show_onsets, show_beat_grid
      FROM sp404_companion_state
      WHERE pad_ref = ?
    `);

    this.upsertStateStmt = this.db.prepare(`
      INSERT OR REPLACE INTO sp404_companion_state
      (pad_ref, zoom_level, scroll_position, grid_snap, grid_subdivision, show_onsets, show_beat_grid, last_viewed)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    this.getPatternStmt = this.db.prepare(`
      SELECT pattern_ref, bpm, bars, parts FROM sp404_patterns WHERE pattern_ref = ?
    `);

    this.upsertPatternStmt = this.db.prepare(`
      INSERT OR REPLACE INTO sp404_patterns (pattern_ref, bpm, bars, parts, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    this.listPatternsStmt = this.db.prepare(`
      SELECT pattern_ref, bpm, bars FROM sp404_patterns ORDER BY updated_at DESC
    `);
  }

  getChops(sourceAssetId: number): ChopPoint[] {
    const rows = this.getChopsStmt.all(sourceAssetId) as any[];
    return rows.map(row => ({
      id: row.id,
      sourceAssetId: row.source_asset_id,
      chopIndex: row.chop_index,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      targetBank: row.target_bank,
      targetPad: row.target_pad,
      crossfadeMs: row.crossfade_ms,
      snapToZero: Boolean(row.snap_to_zero),
    }));
  }

  setChops(sourceAssetId: number, chops: Omit<ChopPoint, 'id' | 'sourceAssetId'>[]): void {
    // Start transaction
    const deleteChops = this.db.transaction(() => {
      this.deleteChopsStmt.run(sourceAssetId);
    });

    const insertChops = this.db.transaction(() => {
      chops.forEach(chop => {
        this.insertChopStmt.run(
          sourceAssetId,
          chop.chopIndex,
          chop.startOffset,
          chop.endOffset,
          chop.targetBank ?? null,
          chop.targetPad ?? null,
          chop.crossfadeMs,
          chop.snapToZero ? 1 : 0
        );
      });
    });

    deleteChops();
    insertChops();
  }

  getState(padRef: string): CompanionState | null {
    const row = this.getStateStmt.get(padRef) as any;
    if (!row) return null;

    return {
      padRef: row.pad_ref,
      zoomLevel: row.zoom_level,
      scrollPosition: row.scroll_position,
      gridSnap: Boolean(row.grid_snap),
      gridSubdivision: row.grid_subdivision,
      showOnsets: Boolean(row.show_onsets),
      showBeatGrid: Boolean(row.show_beat_grid),
    };
  }

  setState(padRef: string, partial: Partial<Omit<CompanionState, 'padRef'>>): void {
    // Get existing state or use defaults
    const existing = this.getState(padRef) ?? {
      padRef,
      zoomLevel: 1.0,
      scrollPosition: 0.0,
      gridSnap: true,
      gridSubdivision: '1/16',
      showOnsets: true,
      showBeatGrid: true,
    };

    // Merge with partial updates
    const merged: CompanionState = { ...existing, ...partial };

    this.upsertStateStmt.run(
      merged.padRef,
      merged.zoomLevel,
      merged.scrollPosition,
      merged.gridSnap ? 1 : 0,
      merged.gridSubdivision,
      merged.showOnsets ? 1 : 0,
      merged.showBeatGrid ? 1 : 0
    );
  }

  async getBeatGrid(filePath: string, durationSec: number): Promise<BeatGrid> {
    // Run aubio tempo to detect BPM
    let bpm = 120;
    let confidence = 0.5;

    try {
      const result = await runProcess('aubio', ['tempo', filePath], { timeout: 30000 });
      if (result.exitCode === 0) {
        const match = result.stdout.match(/tempo:\s*([\d.]+)\s*bpm/i) || result.stdout.match(/([\d.]+)/);
        if (match) {
          bpm = parseFloat(match[1]);
          confidence = 0.9;
        }
      }
    } catch (error) {
      // Fallback to 120 BPM on error
      bpm = 120;
      confidence = 0.5;
    }

    // Generate beat positions: 60 / bpm = seconds per beat
    const beatInterval = 60 / bpm;
    const beatPositions: number[] = [];
    for (let t = 0; t <= durationSec; t += beatInterval) {
      beatPositions.push(t);
    }

    // Bar positions: every 4 beats
    const barPositions = beatPositions.filter((_, i) => i % 4 === 0);

    // Detect onsets
    const onsets = await this.detectOnsets(filePath);

    return {
      bpm,
      confidence,
      beatPositions,
      barPositions,
      onsets,
    };
  }

  async detectOnsets(filePath: string): Promise<number[]> {
    try {
      const result = await runProcess('aubio', ['onset', filePath], { timeout: 30000 });
      if (result.exitCode !== 0) {
        return [];
      }

      // Parse each stdout line as float (seconds)
      const onsets = result.stdout
        .split('\n')
        .map(line => parseFloat(line))
        .filter(val => !isNaN(val))
        .sort((a, b) => a - b);

      return onsets;
    } catch (error) {
      return [];
    }
  }

  async autoChop(
    filePath: string,
    mode: 'equal' | 'beat-aligned' | 'transient',
    options: { count?: number; beats?: number; durationSec?: number; bpm?: number }
  ): Promise<Omit<ChopPoint, 'id' | 'sourceAssetId'>[]> {
    const chops: Omit<ChopPoint, 'id' | 'sourceAssetId'>[] = [];

    if (mode === 'equal') {
      const count = options.count ?? 4;
      const segmentWidth = 1 / count;
      for (let i = 0; i < count; i++) {
        chops.push({
          chopIndex: i,
          startOffset: i * segmentWidth,
          endOffset: (i + 1) * segmentWidth,
          crossfadeMs: 0,
          snapToZero: true,
        });
      }
    } else if (mode === 'beat-aligned') {
      const bpm = options.bpm ?? 120;
      const beats = options.beats ?? 1;
      const durationSec = options.durationSec ?? 30;

      const beatInterval = 60 / bpm;
      const beatGroupInterval = beatInterval * beats;
      let chopIndex = 0;

      for (let t = 0; t < durationSec; t += beatGroupInterval) {
        const startOffset = t / durationSec;
        const endOffset = Math.min(1, (t + beatGroupInterval) / durationSec);

        chops.push({
          chopIndex,
          startOffset,
          endOffset,
          crossfadeMs: 0,
          snapToZero: true,
        });
        chopIndex++;
      }
    } else if (mode === 'transient') {
      const durationSec = options.durationSec ?? 30;
      const onsets = await this.detectOnsets(filePath);

      // Create chops at each onset
      onsets.forEach((onset, i) => {
        const startOffset = onset / durationSec;
        const nextOnset = onsets[i + 1] ?? durationSec;
        const endOffset = Math.min(1, nextOnset / durationSec);

        chops.push({
          chopIndex: i,
          startOffset,
          endOffset,
          crossfadeMs: 0,
          snapToZero: true,
        });
      });
    }

    return chops;
  }

  findNearestZeroCrossing(peaks: number[], cursor: number, windowFraction?: number): number {
    if (peaks.length === 0) return cursor;

    const cursorIdx = Math.round(cursor * (peaks.length - 1));
    const window = Math.round((windowFraction ?? 0.02) * peaks.length);

    // Search for zero-crossing (sign change between consecutive peaks)
    let nearest = cursor;
    let minDistance = Infinity;

    for (let i = Math.max(0, cursorIdx - window); i < Math.min(peaks.length - 1, cursorIdx + window); i++) {
      const current = peaks[i];
      const next = peaks[i + 1];

      // Check if there's a zero-crossing between current and next
      if ((current >= 0 && next < 0) || (current < 0 && next >= 0)) {
        const zeroCrossingIdx = i + Math.abs(current) / (Math.abs(current) + Math.abs(next));
        const normalizedZeroCrossing = zeroCrossingIdx / (peaks.length - 1);
        const distance = Math.abs(normalizedZeroCrossing - cursor);

        if (distance < minDistance) {
          minDistance = distance;
          nearest = normalizedZeroCrossing;
        }
      }
    }

    return nearest;
  }

  getPattern(patternRef: string): PatternData | null {
    const row = this.getPatternStmt.get(patternRef) as any;
    if (!row) return null;

    return {
      patternRef: row.pattern_ref,
      bpm: row.bpm,
      bars: row.bars,
      parts: JSON.parse(row.parts),
    };
  }

  savePattern(pattern: PatternData): void {
    this.upsertPatternStmt.run(
      pattern.patternRef,
      pattern.bpm,
      pattern.bars,
      JSON.stringify(pattern.parts)
    );
  }

  listPatterns(): { patternRef: string; bpm: number; bars: number }[] {
    const rows = this.listPatternsStmt.all() as any[];
    return rows.map(row => ({
      patternRef: row.pattern_ref,
      bpm: row.bpm,
      bars: row.bars,
    }));
  }
}

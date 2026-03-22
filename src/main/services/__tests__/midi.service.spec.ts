import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Mock @tonejs/midi and fs BEFORE importing the service
vi.mock('@tonejs/midi', () => ({
  Midi: vi.fn().mockImplementation((buffer: Buffer) => ({
    header: {
      tempos: [{ bpm: 120 }],
      timeSignatures: [{ timeSignature: [4, 4] }],
      format: 1,
    },
    tracks: [
      { notes: [{ midi: 60 }, { midi: 62 }, { midi: 64 }] },
      { notes: [{ midi: 36 }, { midi: 38 }] },
    ],
    duration: 32.5,
  })),
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn((filePath: string) => {
    // Return a mock buffer for any file
    return Buffer.from([0x4d, 0x54, 0x68, 0x64]); // MThd header
  }),
  statSync: vi.fn((filePath: string) => ({
    size: 4096,
  })),
}));

// Now import the service after mocks are set up
import { MidiFilesService, type MidiFileInfo } from '../midi-files.service';

describe('MidiFilesService', () => {
  let db: Database.Database;
  let service: MidiFilesService;

  beforeEach(() => {
    // Create in-memory SQLite database for testing
    db = new Database(':memory:');

    // Create assets table that midi service references
    db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE
      );
    `);

    service = new MidiFilesService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('parseMidiFile', () => {
    it('should extract tempo, time signature, track count, note count, and duration', () => {
      const filePath = '/test/beat.mid';
      const result = service.parseMidiFile(filePath);

      expect(result.name).toBe('beat.mid');
      expect(result.file_path).toBe(filePath);
      expect(result.file_size).toBe(4096);
      expect(result.tempo).toBe(120);
      expect(result.timeSignature).toBe('4/4');
      expect(result.trackCount).toBe(2);
      expect(result.noteCount).toBe(5); // 3 + 2 notes
      expect(result.durationSec).toBe(32.5);
      expect(result.format).toBe(1);
    });

  });

  describe('importMidi', () => {
    it('should store parsed MIDI file in database and return with id', () => {
      const filePath = '/test/beat.mid';
      const result = service.importMidi(filePath);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('beat.mid');
      expect(result.file_path).toBe(filePath);
      expect(result.tempo).toBe(120);
      expect(result.created_at).toBeDefined();
    });

    it('should throw error when importing same file twice (UNIQUE constraint)', () => {
      const filePath = '/test/beat.mid';
      service.importMidi(filePath);

      expect(() => {
        service.importMidi(filePath);
      }).toThrow();
    });
  });

  describe('listMidi', () => {
    it('should return all imported MIDI files', () => {
      service.importMidi('/test/beat1.mid');
      service.importMidi('/test/beat2.mid');

      const result = service.listMidi();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('beat1.mid');
      expect(result[1].name).toBe('beat2.mid');
    });

    it('should return empty array if no MIDI files', () => {
      const result = service.listMidi();
      expect(result).toEqual([]);
    });
  });

  describe('deleteMidi', () => {
    it('should delete a MIDI file record by id', () => {
      const midi = service.importMidi('/test/beat.mid');
      expect(service.listMidi()).toHaveLength(1);

      service.deleteMidi(midi.id!);

      expect(service.listMidi()).toHaveLength(0);
    });
  });

  describe('linkToAsset', () => {
    it('should create a link between MIDI and audio asset', () => {
      const midi = service.importMidi('/test/beat.mid');
      const assetId = 123;

      // Should not throw
      service.linkToAsset(midi.id!, assetId);

      // Verify link exists
      const midiForAsset = service.getMidiForAsset(assetId);
      expect(midiForAsset).toHaveLength(1);
      expect(midiForAsset[0].id).toBe(midi.id);
    });

    it('should not create duplicate links', () => {
      const midi = service.importMidi('/test/beat.mid');
      const assetId = 123;

      service.linkToAsset(midi.id!, assetId);
      expect(() => {
        service.linkToAsset(midi.id!, assetId);
      }).toThrow();
    });
  });

  describe('unlinkFromAsset', () => {
    it('should remove a link between MIDI and audio asset', () => {
      const midi = service.importMidi('/test/beat.mid');
      const assetId = 123;

      service.linkToAsset(midi.id!, assetId);
      expect(service.getMidiForAsset(assetId)).toHaveLength(1);

      service.unlinkFromAsset(midi.id!, assetId);

      expect(service.getMidiForAsset(assetId)).toHaveLength(0);
    });
  });

  describe('getMidiForAsset', () => {
    it('should return all MIDI files linked to an asset', () => {
      const midi1 = service.importMidi('/test/beat1.mid');
      const midi2 = service.importMidi('/test/beat2.mid');
      const assetId = 123;

      service.linkToAsset(midi1.id!, assetId);
      service.linkToAsset(midi2.id!, assetId);

      const result = service.getMidiForAsset(assetId);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id).sort()).toEqual([midi1.id, midi2.id].sort());
    });

    it('should return empty array if asset has no MIDI files', () => {
      const result = service.getMidiForAsset(999);
      expect(result).toEqual([]);
    });
  });

  describe('getAssetsForMidi', () => {
    it('should return all audio assets linked to a MIDI file', () => {
      const midi = service.importMidi('/test/beat.mid');

      service.linkToAsset(midi.id!, 1);
      service.linkToAsset(midi.id!, 2);

      const result = service.getAssetsForMidi(midi.id!);

      expect(result).toHaveLength(2);
    });

    it('should return empty array if MIDI has no linked assets', () => {
      const midi = service.importMidi('/test/beat.mid');
      const result = service.getAssetsForMidi(midi.id!);
      expect(result).toEqual([]);
    });
  });

  describe('updateTags', () => {
    it('should save tags as JSON array', () => {
      const midi = service.importMidi('/test/beat.mid');
      const tags = ['drums', 'sample', 'breakbeat'];

      service.updateTags(midi.id!, tags);

      const updated = service.listMidi()[0];
      expect(updated.tags).toEqual(tags);
    });

    it('should replace existing tags', () => {
      const midi = service.importMidi('/test/beat.mid');

      service.updateTags(midi.id!, ['old']);
      let updated = service.listMidi()[0];
      expect(updated.tags).toEqual(['old']);

      service.updateTags(midi.id!, ['new', 'tags']);
      updated = service.listMidi()[0];
      expect(updated.tags).toEqual(['new', 'tags']);
    });

    it('should handle empty tags array', () => {
      const midi = service.importMidi('/test/beat.mid');

      service.updateTags(midi.id!, []);

      const updated = service.listMidi()[0];
      expect(updated.tags).toEqual([]);
    });
  });
});

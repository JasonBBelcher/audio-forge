import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AddTrackCommand,
  RemoveTrackCommand,
  RenameTrackCommand,
  ReorderTrackCommand,
  SetVolumeCommand,
  SetMuteCommand,
  SetSoloCommand,
} from '../trackCommands';

// ── Shared track fixture ───────────────────────────────────────────────────

type Track = { id: string; name: string; volume: number; muted: boolean; solo: boolean; hasAudio: boolean };

function makeTrack(id: string, name = 'Track'): Track {
  return { id, name, volume: 0.8, muted: false, solo: false, hasAudio: false };
}

// ── AddTrackCommand ────────────────────────────────────────────────────────

describe('AddTrackCommand', () => {
  it('execute adds the track to the list', () => {
    const tracks = [makeTrack('1')];
    const newTrack = makeTrack('2', 'Track 2');
    const addAudio = vi.fn();
    const removeAudio = vi.fn();
    const setTracks = vi.fn();
    const cmd = new AddTrackCommand(tracks, newTrack, addAudio, setTracks, removeAudio);
    cmd.execute();
    expect(setTracks).toHaveBeenCalledWith([...tracks, newTrack]);
    expect(addAudio).toHaveBeenCalledWith('2');
  });

  it('undo removes the track from the list', () => {
    const newTrack = makeTrack('2', 'Track 2');
    const tracks = [makeTrack('1'), newTrack];
    const addAudio = vi.fn();
    const removeAudio = vi.fn();
    const setTracks = vi.fn();
    const cmd = new AddTrackCommand(tracks, newTrack, addAudio, setTracks, removeAudio);
    cmd.undo();
    expect(setTracks).toHaveBeenCalledWith([tracks[0]]);
    expect(removeAudio).toHaveBeenCalledWith('2');
  });

  it('has name "Add Track"', () => {
    const cmd = new AddTrackCommand([], makeTrack('1'), vi.fn(), vi.fn());
    expect(cmd.name).toBe('Add Track');
  });
});

// ── RemoveTrackCommand ─────────────────────────────────────────────────────

describe('RemoveTrackCommand', () => {
  it('execute removes the track from the list', () => {
    const t1 = makeTrack('1');
    const t2 = makeTrack('2');
    const tracks = [t1, t2];
    const removeAudio = vi.fn();
    const addAudio = vi.fn();
    const setTracks = vi.fn();
    const cmd = new RemoveTrackCommand(tracks, '2', removeAudio, setTracks, addAudio);
    cmd.execute();
    expect(setTracks).toHaveBeenCalledWith([t1]);
    expect(removeAudio).toHaveBeenCalledWith('2');
  });

  it('undo restores the track at its original position', () => {
    const t1 = makeTrack('1');
    const t2 = makeTrack('2');
    const tracks = [t1, t2];
    const removeAudio = vi.fn();
    const addAudio = vi.fn();
    const setTracks = vi.fn();
    const cmd = new RemoveTrackCommand(tracks, '2', removeAudio, setTracks, addAudio);
    cmd.undo();
    expect(setTracks).toHaveBeenCalledWith([t1, t2]);
    expect(addAudio).toHaveBeenCalledWith('2');
  });

  it('has name "Remove Track"', () => {
    const cmd = new RemoveTrackCommand([], '1', vi.fn(), vi.fn());
    expect(cmd.name).toBe('Remove Track');
  });
});

// ── RenameTrackCommand ─────────────────────────────────────────────────────

describe('RenameTrackCommand', () => {
  it('execute sets the new name', () => {
    const tracks = [makeTrack('1', 'Old Name')];
    const setTracks = vi.fn();
    const cmd = new RenameTrackCommand(tracks, '1', 'Old Name', 'New Name', setTracks);
    cmd.execute();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result[0].name).toBe('New Name');
  });

  it('undo restores the old name', () => {
    const tracks = [makeTrack('1', 'Old Name')];
    const setTracks = vi.fn();
    const cmd = new RenameTrackCommand(tracks, '1', 'Old Name', 'New Name', setTracks);
    cmd.undo();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result[0].name).toBe('Old Name');
  });

  it('has name "Rename Track"', () => {
    const cmd = new RenameTrackCommand([], '1', 'a', 'b', vi.fn());
    expect(cmd.name).toBe('Rename Track');
  });
});

// ── ReorderTrackCommand ────────────────────────────────────────────────────

describe('ReorderTrackCommand', () => {
  it('execute moves the track from source to destination index', () => {
    const t1 = makeTrack('1');
    const t2 = makeTrack('2');
    const t3 = makeTrack('3');
    const tracks = [t1, t2, t3];
    const setTracks = vi.fn();
    const cmd = new ReorderTrackCommand(tracks, 0, 2, setTracks);
    cmd.execute();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result.map(t => t.id)).toEqual(['2', '3', '1']);
  });

  it('undo reverses the reorder', () => {
    const t1 = makeTrack('1');
    const t2 = makeTrack('2');
    const t3 = makeTrack('3');
    const tracks = [t1, t2, t3];
    const setTracks = vi.fn();
    const cmd = new ReorderTrackCommand(tracks, 0, 2, setTracks);
    cmd.undo();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result.map(t => t.id)).toEqual(['1', '2', '3']);
  });

  it('has name "Reorder Tracks"', () => {
    const cmd = new ReorderTrackCommand([], 0, 1, vi.fn());
    expect(cmd.name).toBe('Reorder Tracks');
  });
});

// ── SetVolumeCommand ───────────────────────────────────────────────────────

describe('SetVolumeCommand', () => {
  it('execute sets the new volume on the track', () => {
    const tracks = [makeTrack('1')];
    const setTracks = vi.fn();
    const setAudio = vi.fn();
    const cmd = new SetVolumeCommand(tracks, '1', 0.8, 0.5, setTracks, setAudio);
    cmd.execute();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result[0].volume).toBe(0.5);
    expect(setAudio).toHaveBeenCalledWith('1', 0.5);
  });

  it('undo restores the old volume', () => {
    const tracks = [makeTrack('1')];
    const setTracks = vi.fn();
    const setAudio = vi.fn();
    const cmd = new SetVolumeCommand(tracks, '1', 0.8, 0.5, setTracks, setAudio);
    cmd.undo();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result[0].volume).toBe(0.8);
    expect(setAudio).toHaveBeenCalledWith('1', 0.8);
  });

  it('has name "Set Volume"', () => {
    const cmd = new SetVolumeCommand([], '1', 0, 1, vi.fn(), vi.fn());
    expect(cmd.name).toBe('Set Volume');
  });
});

// ── SetMuteCommand ─────────────────────────────────────────────────────────

describe('SetMuteCommand', () => {
  it('execute sets muted to true', () => {
    const tracks = [makeTrack('1')];
    const setTracks = vi.fn();
    const setAudio = vi.fn();
    const cmd = new SetMuteCommand(tracks, '1', false, true, setTracks, setAudio);
    cmd.execute();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result[0].muted).toBe(true);
    expect(setAudio).toHaveBeenCalledWith('1', true);
  });

  it('undo restores previous mute state', () => {
    const tracks = [makeTrack('1')];
    const setTracks = vi.fn();
    const setAudio = vi.fn();
    const cmd = new SetMuteCommand(tracks, '1', false, true, setTracks, setAudio);
    cmd.undo();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result[0].muted).toBe(false);
    expect(setAudio).toHaveBeenCalledWith('1', false);
  });

  it('has name "Mute Track"', () => {
    const cmd = new SetMuteCommand([], '1', false, true, vi.fn(), vi.fn());
    expect(cmd.name).toBe('Mute Track');
  });
});

// ── SetSoloCommand ─────────────────────────────────────────────────────────

describe('SetSoloCommand', () => {
  it('execute sets solo on the target track and clears others', () => {
    const t1 = makeTrack('1');
    const t2 = makeTrack('2');
    const tracks = [t1, t2];
    const setTracks = vi.fn();
    const setAudio = vi.fn();
    const cmd = new SetSoloCommand(tracks, '1', false, true, setTracks, setAudio);
    cmd.execute();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result.find(t => t.id === '1')!.solo).toBe(true);
    expect(result.find(t => t.id === '2')!.solo).toBe(false);
    expect(setAudio).toHaveBeenCalledWith('1', true);
  });

  it('undo restores previous solo states', () => {
    const tracks = [makeTrack('1')];
    const setTracks = vi.fn();
    const setAudio = vi.fn();
    const cmd = new SetSoloCommand(tracks, '1', false, true, setTracks, setAudio);
    cmd.undo();
    const result: Track[] = setTracks.mock.calls[0][0];
    expect(result[0].solo).toBe(false);
    expect(setAudio).toHaveBeenCalledWith('1', false);
  });

  it('has name "Solo Track"', () => {
    const cmd = new SetSoloCommand([], '1', false, true, vi.fn(), vi.fn());
    expect(cmd.name).toBe('Solo Track');
  });
});

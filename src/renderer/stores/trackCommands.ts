import type { Command } from './historyStore';

type Track = { id: string; name: string; volume: number; muted: boolean; solo: boolean; hasAudio: boolean };

// ── AddTrackCommand ────────────────────────────────────────────────────────

export class AddTrackCommand implements Command {
  name = 'Add Track';

  constructor(
    private tracks: Track[],
    private track: Track,
    private addAudio: (id: string) => void,
    private setTracks: (t: Track[]) => void,
    private removeAudio: (id: string) => void = addAudio,
  ) {}

  execute() {
    this.setTracks([...this.tracks, this.track]);
    this.addAudio(this.track.id);
  }

  undo() {
    this.setTracks(this.tracks.filter(t => t.id !== this.track.id));
    this.removeAudio(this.track.id);
  }
}

// ── RemoveTrackCommand ─────────────────────────────────────────────────────

export class RemoveTrackCommand implements Command {
  name = 'Remove Track';
  private snapshot: Track[];
  private removed: Track | undefined;

  constructor(
    private tracks: Track[],
    private trackId: string,
    private removeAudio: (id: string) => void,
    private setTracks: (t: Track[]) => void,
    private addAudio: (id: string) => void = removeAudio,
  ) {
    this.snapshot = [...tracks];
    this.removed = tracks.find(t => t.id === trackId);
  }

  execute() {
    this.setTracks(this.tracks.filter(t => t.id !== this.trackId));
    this.removeAudio(this.trackId);
  }

  undo() {
    this.setTracks([...this.snapshot]);
    if (this.removed) this.addAudio(this.removed.id);
  }
}

// ── RenameTrackCommand ─────────────────────────────────────────────────────

export class RenameTrackCommand implements Command {
  name = 'Rename Track';

  constructor(
    private tracks: Track[],
    private trackId: string,
    private oldName: string,
    private newName: string,
    private setTracks: (t: Track[]) => void,
  ) {}

  execute() {
    this.setTracks(this.tracks.map(t =>
      t.id === this.trackId ? { ...t, name: this.newName } : t
    ));
  }

  undo() {
    this.setTracks(this.tracks.map(t =>
      t.id === this.trackId ? { ...t, name: this.oldName } : t
    ));
  }
}

// ── ReorderTrackCommand ────────────────────────────────────────────────────

export class ReorderTrackCommand implements Command {
  name = 'Reorder Tracks';
  private snapshot: Track[];

  constructor(
    private tracks: Track[],
    private from: number,
    private to: number,
    private setTracks: (t: Track[]) => void,
  ) {
    this.snapshot = [...tracks];
  }

  execute() {
    const reordered = [...this.tracks];
    const [moved] = reordered.splice(this.from, 1);
    reordered.splice(this.to, 0, moved);
    this.setTracks(reordered);
  }

  undo() {
    this.setTracks([...this.snapshot]);
  }
}

// ── SetVolumeCommand ───────────────────────────────────────────────────────

export class SetVolumeCommand implements Command {
  name = 'Set Volume';

  constructor(
    private tracks: Track[],
    private trackId: string,
    private oldVolume: number,
    private newVolume: number,
    private setTracks: (t: Track[]) => void,
    private setAudio: (id: string, volume: number) => void,
  ) {}

  execute() {
    this.setTracks(this.tracks.map(t =>
      t.id === this.trackId ? { ...t, volume: this.newVolume } : t
    ));
    this.setAudio(this.trackId, this.newVolume);
  }

  undo() {
    this.setTracks(this.tracks.map(t =>
      t.id === this.trackId ? { ...t, volume: this.oldVolume } : t
    ));
    this.setAudio(this.trackId, this.oldVolume);
  }
}

// ── SetMuteCommand ─────────────────────────────────────────────────────────

export class SetMuteCommand implements Command {
  name = 'Mute Track';

  constructor(
    private tracks: Track[],
    private trackId: string,
    private oldMuted: boolean,
    private newMuted: boolean,
    private setTracks: (t: Track[]) => void,
    private setAudio: (id: string, muted: boolean) => void,
  ) {}

  execute() {
    this.setTracks(this.tracks.map(t =>
      t.id === this.trackId ? { ...t, muted: this.newMuted } : t
    ));
    this.setAudio(this.trackId, this.newMuted);
  }

  undo() {
    this.setTracks(this.tracks.map(t =>
      t.id === this.trackId ? { ...t, muted: this.oldMuted } : t
    ));
    this.setAudio(this.trackId, this.oldMuted);
  }
}

// ── SetSoloCommand ─────────────────────────────────────────────────────────

export class SetSoloCommand implements Command {
  name = 'Solo Track';
  private snapshot: Track[];

  constructor(
    private tracks: Track[],
    private trackId: string,
    private oldSolo: boolean,
    private newSolo: boolean,
    private setTracks: (t: Track[]) => void,
    private setAudio: (id: string, solo: boolean) => void,
  ) {
    this.snapshot = [...tracks];
  }

  execute() {
    this.setTracks(this.tracks.map(t =>
      t.id === this.trackId
        ? { ...t, solo: this.newSolo }
        : { ...t, solo: false }
    ));
    this.setAudio(this.trackId, this.newSolo);
  }

  undo() {
    this.setTracks([...this.snapshot]);
    this.setAudio(this.trackId, this.oldSolo);
  }
}

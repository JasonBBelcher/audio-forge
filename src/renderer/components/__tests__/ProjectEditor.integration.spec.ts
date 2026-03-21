// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ProjectEditor from '../ProjectEditor.svelte';
import { projectStore } from '../../stores/projectStore';
import { playbackStore } from '../../stores/playbackStore';
import { audioEngine as mockAudioEngine, tapTempo as mockTapTempo } from '../../services/audioEngine';
import { recordingService as mockRecordingService } from '../../services/recordingService';

vi.mock('../../services/audioEngine', () => ({
  audioEngine: {
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    loadFile: vi.fn(),
    getTrackBuffer: vi.fn().mockReturnValue(null),
    hasAudio: vi.fn().mockReturnValue(false),
  },
  metronome: { start: vi.fn(), stop: vi.fn(), isActive: vi.fn().mockReturnValue(false) },
  tapTempo: { tap: vi.fn().mockReturnValue(null), reset: vi.fn() },
}));

vi.mock('../YouTubeImportModal.svelte', () => ({ default: { render: () => '' } }));

vi.mock('../../services/recordingService', () => ({
  recordingService: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    isRecording: vi.fn().mockReturnValue(false),
    getTrackId: vi.fn().mockReturnValue(null),
    onComplete: null,
  },
}));

const testProject = {
  id: 'integration-test',
  name: 'Integration Test',
  bpm: 120,
  timeSignature: '4/4',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ProjectEditor Integration', () => {
  beforeEach(() => {
    projectStore.setCurrentProject(testProject);
    playbackStore.reset?.();
    vi.clearAllMocks();
  });

  it('play button calls audioEngine.play', async () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    const playBtn = btns.find(b => b.textContent?.includes('Play')) as HTMLButtonElement;
    await fireEvent.click(playBtn);
    expect(mockAudioEngine.play).toHaveBeenCalled();
  });

  it('stop button calls audioEngine.stop', async () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    const stopBtn = btns.find(b => b.textContent?.includes('Stop')) as HTMLButtonElement;
    await fireEvent.click(stopBtn);
    expect(mockAudioEngine.stop).toHaveBeenCalled();
  });

  it('back button clears current project', async () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    const backBtn = btns.find(b => b.textContent?.includes('Back')) as HTMLButtonElement;
    await fireEvent.click(backBtn);
    expect(get(projectStore.getCurrentProject())).toBeNull();
  });

  it('add track button adds a track row', async () => {
    const { container } = render(ProjectEditor);
    const tracksBefore = container.querySelectorAll('.track-row').length;

    const btns = Array.from(container.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent?.includes('Track') && b.textContent?.includes('+')) as HTMLButtonElement;
    await fireEvent.click(addBtn);

    expect(container.querySelectorAll('.track-row').length).toBeGreaterThan(tracksBefore);
  });

  it('each track row has a record button', () => {
    const { container } = render(ProjectEditor);
    const trackRows = container.querySelectorAll('.track-row');
    expect(trackRows.length).toBeGreaterThan(0);
    trackRows.forEach(row => {
      const recordBtn = row.querySelector('.record-btn');
      expect(recordBtn).toBeTruthy();
    });
  });

  it('clicking record button calls recordingService.start', async () => {
    const { container } = render(ProjectEditor);
    const recordBtn = container.querySelector('.record-btn') as HTMLButtonElement;
    await fireEvent.click(recordBtn);
    expect(mockRecordingService.start).toHaveBeenCalled();
  });

  describe('Tap Tempo BPM sync', () => {
    it('tap button calls tapTempo.tap()', async () => {
      const { container } = render(ProjectEditor);
      const btns = Array.from(container.querySelectorAll('button'));
      const tapBtn = btns.find(b => b.textContent?.includes('Tap')) as HTMLButtonElement;
      await fireEvent.click(tapBtn);
      expect(mockTapTempo.tap).toHaveBeenCalled();
    });

    it('updates project BPM when tap returns a value', async () => {
      vi.mocked(mockTapTempo.tap).mockReturnValueOnce(135);
      const { container } = render(ProjectEditor);
      const btns = Array.from(container.querySelectorAll('button'));
      const tapBtn = btns.find(b => b.textContent?.includes('Tap')) as HTMLButtonElement;
      await fireEvent.click(tapBtn);
      const project = get(projectStore.getCurrentProject());
      expect(project?.bpm).toBe(135);
    });

    it('does not update project BPM when tap returns null (first tap)', async () => {
      vi.mocked(mockTapTempo.tap).mockReturnValueOnce(null);
      const { container } = render(ProjectEditor);
      const btns = Array.from(container.querySelectorAll('button'));
      const tapBtn = btns.find(b => b.textContent?.includes('Tap')) as HTMLButtonElement;
      await fireEvent.click(tapBtn);
      const project = get(projectStore.getCurrentProject());
      expect(project?.bpm).toBe(120); // unchanged
    });
  });

  describe('Track inline rename', () => {
    it('double-clicking a track name shows an input field', async () => {
      const { container } = render(ProjectEditor);
      const trackName = container.querySelector('.track-name') as HTMLElement;
      await fireEvent.dblClick(trackName);
      expect(container.querySelector('.track-name-input')).toBeTruthy();
    });

    it('submitting the rename input updates the track name', async () => {
      const { container } = render(ProjectEditor);
      const trackName = container.querySelector('.track-name') as HTMLElement;
      await fireEvent.dblClick(trackName);
      const input = container.querySelector('.track-name-input') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'Bass Guitar' } });
      await fireEvent.keyDown(input, { key: 'Enter' });
      expect(container.querySelector('.track-name')?.textContent).toContain('Bass Guitar');
      expect(container.querySelector('.track-name-input')).toBeFalsy();
    });

    it('pressing Escape reverts the rename', async () => {
      const { container } = render(ProjectEditor);
      const trackName = container.querySelector('.track-name') as HTMLElement;
      const originalName = trackName.textContent?.trim();
      await fireEvent.dblClick(trackName);
      const input = container.querySelector('.track-name-input') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'Something Else' } });
      await fireEvent.keyDown(input, { key: 'Escape' });
      expect(container.querySelector('.track-name')?.textContent?.trim()).toBe(originalName);
      expect(container.querySelector('.track-name-input')).toBeFalsy();
    });

    it('blurring the rename input commits the new name', async () => {
      const { container } = render(ProjectEditor);
      const trackName = container.querySelector('.track-name') as HTMLElement;
      await fireEvent.dblClick(trackName);
      const input = container.querySelector('.track-name-input') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'Lead Synth' } });
      await fireEvent.blur(input);
      expect(container.querySelector('.track-name')?.textContent).toContain('Lead Synth');
    });
  });
});
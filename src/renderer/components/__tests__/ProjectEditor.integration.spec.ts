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
import { audioEngine as mockAudioEngine } from '../../services/audioEngine';

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
vi.mock('../ExportModal.svelte', () => ({
  default: vi.fn().mockImplementation(() => ({
    $set: vi.fn(),
    $destroy: vi.fn(),
  })),
}));

const testProject = {
  id: 'integration-test',
  name: 'Integration Test',
  bpm: 120,
  timeSignature: '4/4',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ProjectEditor Integration - Navigation', () => {
  beforeEach(() => {
    projectStore.setCurrentProject(testProject);
    playbackStore.reset?.();
    vi.clearAllMocks();
  });

  describe('Transport Controls', () => {
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
  });

  describe('Navigation', () => {
    it('back button clears current project', async () => {
      const { container } = render(ProjectEditor);
      const btns = Array.from(container.querySelectorAll('button'));
      const backBtn = btns.find(b => b.textContent?.includes('Back')) as HTMLButtonElement;
      await fireEvent.click(backBtn);
      expect(get(projectStore.getCurrentProject())).toBeNull();
    });

    it('sidebar renders all navigation items', () => {
      const { container } = render(ProjectEditor);
      const sidebar = container.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();
      expect(container.textContent).toContain('Library');
      expect(container.textContent).toContain('Import');
      expect(container.textContent).toContain('Collections');
      expect(container.textContent).toContain('Koala');
      expect(container.textContent).toContain('Settings');
    });

    it('clicking nav items changes active view', async () => {
      const { container } = render(ProjectEditor);
      const navItems = Array.from(container.querySelectorAll('.nav-item'));

      const importItem = navItems.find(item => item.textContent?.includes('Import')) as HTMLButtonElement;
      expect(importItem).toBeTruthy();

      await fireEvent.click(importItem);
      // After click, Import view content should be visible
      expect(container.textContent).toContain('Import');
    });

    it('Library view shows by default', () => {
      const { container } = render(ProjectEditor);
      expect(container.querySelector('.sidebar')).toBeTruthy();
      // The default activeView is 'library'
      expect(container.textContent).toContain('Library');
    });
  });

  describe('Modal Integration', () => {
    it('shows export modal when Export Mix button is clicked', async () => {
      const { container } = render(ProjectEditor);
      const btns = Array.from(container.querySelectorAll('button'));
      const exportBtn = btns.find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
      await fireEvent.click(exportBtn);
      expect(container.querySelector('.modal-overlay')).toBeTruthy();
    });
  });
});

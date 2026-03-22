<script lang="ts">
  import { projectStore } from '../stores/projectStore';
  import { playbackStore } from '../stores/playbackStore';
  import { audioEngine, metronome, tapTempo } from '../services/audioEngine';
  import { recordingService } from '../services/recordingService';
  import { historyStore } from '../stores/historyStore';
  import {
    AddTrackCommand,
    RemoveTrackCommand,
    RenameTrackCommand,
    ReorderTrackCommand,
    SetVolumeCommand,
    SetMuteCommand,
    SetSoloCommand,
  } from '../stores/trackCommands';
  import type { Project } from '../stores/projectStore';
  import Button from './ui/Button.svelte';
  import Fader from './ui/Fader.svelte';
  import Waveform from './ui/Waveform.svelte';
  import YouTubeImportModal from './YouTubeImportModal.svelte';
  import ExportModal from './ExportModal.svelte';
  import Sidebar from './Sidebar.svelte';
  import LibraryView from './LibraryView.svelte';
  import ImportView from './ImportView.svelte';
  import CollectionsView from './CollectionsView.svelte';
  import KoalaKitBuilder from './KoalaKitBuilder.svelte';
  import SP404KitBuilder from './SP404KitBuilder.svelte';
  import HealthPanel from './HealthPanel.svelte';
  import JobsPanel from './JobsPanel.svelte';
  import WaveEditor from './WaveEditor.svelte';
  import AudioPreview from './AudioPreview.svelte';
  import { onMount, onDestroy } from 'svelte';

  let project: Project | null = null;
  let playback: any = null;
  let metronomeOn = false;
  let youtubeModal: { trackId: string; trackName: string } | null = null;
  let recordingTrackId: string | null = null;
  let showExportModal = false;
  let renamingTrackId: string | null = null;
  let renameValue = '';
  let dragSourceIndex: number | null = null;
  let dragOverIndex: number | null = null;
  let activeView = 'library';
  let selectedFilePath: string | null = null;
  let selectedFileName: string | null = null;
  let previewFilePath: string = '';
  let previewFileName: string = '';
  let tracks: any[] = [
    { id: '1', name: 'Track 1', volume: 0.8, muted: false, solo: false, hasAudio: false },
    { id: '2', name: 'Track 2', volume: 0.7, muted: false, solo: false, hasAudio: false },
  ];

  onMount(() => {
    // Register initial tracks with audio engine
    tracks.forEach(t => audioEngine.addTrack(t.id));

    const unsubProject = projectStore.getCurrentProject().subscribe((p) => {
      project = p;
    });

    const unsubPlayback = playbackStore.subscribe((p) => {
      playback = p;
    });

    return () => {
      unsubProject();
      unsubPlayback();
      metronome.stop();
    };
  });

  function handlePlay() {
    audioEngine.play();
  }

  function handlePause() {
    audioEngine.pause();
  }

  function handleStop() {
    audioEngine.stop();
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Do not intercept shortcuts when user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        historyStore.redo();
      } else {
        historyStore.undo();
      }
      return;
    }

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (playback?.isPlaying) {
        handlePause();
      } else {
        handlePlay();
      }
    } else if (e.key === 'Escape') {
      handleStop();
    }
  }

  function setTracks(updated: typeof tracks) {
    tracks = updated;
  }

  function handleAddTrack() {
    const id = `track_${Date.now()}`;
    const newTrack = {
      id,
      name: `Track ${tracks.length + 1}`,
      volume: 0.8,
      muted: false,
      solo: false,
      hasAudio: false,
    };
    historyStore.push(new AddTrackCommand(
      tracks, newTrack,
      audioEngine.addTrack.bind(audioEngine),
      setTracks,
      audioEngine.removeTrack.bind(audioEngine),
    ));
  }

  function handleRemoveTrack(id: string) {
    historyStore.push(new RemoveTrackCommand(
      tracks, id,
      audioEngine.removeTrack.bind(audioEngine),
      setTracks,
      audioEngine.addTrack.bind(audioEngine),
    ));
  }

  function handleTrackVolumeChange(id: string, volume: number) {
    const old = tracks.find(t => t.id === id)?.volume ?? volume;
    historyStore.push(new SetVolumeCommand(tracks, id, old, volume, setTracks, audioEngine.setTrackVolume.bind(audioEngine)));
  }

  function handleTrackMute(id: string) {
    const track = tracks.find(t => t.id === id);
    if (!track) return;
    historyStore.push(new SetMuteCommand(tracks, id, track.muted, !track.muted, setTracks, audioEngine.setTrackMute.bind(audioEngine)));
  }

  function handleTrackSolo(id: string) {
    const track = tracks.find(t => t.id === id);
    if (!track) return;
    historyStore.push(new SetSoloCommand(tracks, id, track.solo, !track.solo, setTracks, audioEngine.setTrackSolo.bind(audioEngine)));
  }

  async function handleLoadAudio(id: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await audioEngine.loadFile(id, file);
      tracks = tracks.map((t) =>
        t.id === id ? { ...t, name: file.name.replace(/\.[^/.]+$/, ''), hasAudio: true } : t
      );
    };
    input.click();
  }

  function handleToggleMetronome() {
    if (metronomeOn) {
      metronome.stop();
      metronomeOn = false;
    } else {
      metronome.start(project?.bpm ?? 120);
      metronomeOn = true;
    }
  }

  function handleTapTempo() {
    const bpm = tapTempo.tap();
    if (bpm && project) {
      projectStore.updateProject(project.id, { bpm });
    }
  }

  function startRename(trackId: string, currentName: string) {
    renamingTrackId = trackId;
    renameValue = currentName;
  }

  function commitRename() {
    if (!renamingTrackId) return;
    const trimmed = renameValue.trim();
    const oldName = tracks.find(t => t.id === renamingTrackId)?.name ?? '';
    if (trimmed && trimmed !== oldName) {
      historyStore.push(new RenameTrackCommand(tracks, renamingTrackId, oldName, trimmed, setTracks));
    }
    renamingTrackId = null;
  }

  function cancelRename() {
    renamingTrackId = null;
  }

  function handleRenameKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') cancelRename();
  }

  function handleDragStart(index: number) {
    dragSourceIndex = index;
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex = index;
  }

  function handleDrop(e: DragEvent, index: number) {
    e.preventDefault();
    if (dragSourceIndex === null || dragSourceIndex === index) {
      dragSourceIndex = null;
      dragOverIndex = null;
      return;
    }
    historyStore.push(new ReorderTrackCommand(tracks, dragSourceIndex, index, setTracks));
    dragSourceIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    dragSourceIndex = null;
    dragOverIndex = null;
  }

  function handleOpenYouTubeImport(trackId: string, trackName: string) {
    youtubeModal = { trackId, trackName };
  }

  async function handleRecord(trackId: string) {
    if (recordingService.isRecording()) {
      recordingService.stop();
      recordingTrackId = null;
    } else {
      recordingTrackId = trackId;
      recordingService.onComplete = async (blob: Blob) => {
        recordingTrackId = null;
        const arrayBuffer = await blob.arrayBuffer();
        await audioEngine.loadFile(trackId, arrayBuffer);
        tracks = tracks.map(t =>
          t.id === trackId ? { ...t, hasAudio: true } : t
        );
      };
      try {
        await recordingService.start(trackId);
      } catch {
        recordingTrackId = null;
      }
    }
  }

  async function handleYouTubeImported(e: CustomEvent<{ filePath: string; title: string }>) {
    const { filePath, title } = e.detail;
    if (!youtubeModal) return;
    const { trackId } = youtubeModal;
    youtubeModal = null;

    try {
      const af = (window as any).audioforge;
      // Read file bytes via IPC (file:// is blocked by CSP in renderer)
      const buffer: Buffer = await af.files.readAsArrayBuffer(filePath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      const file = new File([blob], title + '.wav', { type: 'audio/wav' });
      await audioEngine.loadFile(trackId, file);
      tracks = tracks.map(t =>
        t.id === trackId ? { ...t, name: title, hasAudio: true } : t
      );
    } catch (err) {
      console.error('Failed to load downloaded audio:', err);
    }
  }

  function handleMasterVolumeChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value) / 100;
    audioEngine.setMasterVolume(val);
  }

  function handleTimelineClick(e: MouseEvent) {
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time = ratio * (playback?.duration || 0);
    audioEngine.seek(time);
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleLibraryEdit(e: CustomEvent<{ asset: any }>) {
    const { asset } = e.detail;
    selectedFilePath = asset.file_path;
    selectedFileName = asset.name;
    activeView = 'wave-editor';
  }

  function handleLibraryPreview(e: CustomEvent<{ filePath: string; fileName: string }>) {
    const { filePath, fileName } = e.detail;
    previewFilePath = filePath;
    previewFileName = fileName;
  }

</script>

<svelte:window on:keydown={handleKeyDown} />

{#if !project}
  <div class="editor-empty">
    <p>No project selected</p>
    <Button on:click={() => projectStore.setCurrentProject(null)} variant="secondary">
      Back to Dashboard
    </Button>
  </div>
{:else}
  <div class="editor">
  <header class="editor-header">
    <div class="header-left">
      <h1>{project.name}</h1>
      <span class="meta">{project.bpm} BPM • {project.timeSignature}</span>
    </div>
    <div class="header-right">
      <button class="export-project-btn" on:click={() => showExportModal = true}>
        ⬇ Export Mix
      </button>
      <Button on:click={() => projectStore.setCurrentProject(null)} variant="secondary">
        ← Back
      </Button>
    </div>
  </header>

  <div class="editor-content">
    <!-- Transport Controls -->
    <section class="transport">
      <div class="transport-buttons">
        {#if !playback?.isPlaying}
          <Button on:click={handlePlay} variant="primary">▶ Play</Button>
        {:else}
          <Button on:click={handlePause} variant="primary">⏸ Pause</Button>
        {/if}
        <Button on:click={handleStop} variant="secondary">⏹ Stop</Button>
        <div class="transport-divider"></div>
        <button
          class="undo-btn"
          on:click={() => historyStore.undo()}
          disabled={!$historyStore.canUndo}
          title="Undo"
        >↩ Undo</button>
        <button
          class="undo-btn"
          on:click={() => historyStore.redo()}
          disabled={!$historyStore.canRedo}
          title="Redo"
        >↪ Redo</button>
        <div class="transport-divider"></div>
        <button
          class={`metro-btn ${metronomeOn ? 'active' : ''}`}
          on:click={handleToggleMetronome}
          title="Toggle metronome"
        >🥁 {metronomeOn ? 'Metro ON' : 'Metro'}</button>
        <button class="tap-btn" on:click={handleTapTempo} title="Tap to set BPM">
          Tap {project?.bpm ?? 120}
        </button>
      </div>

      <div class="timeline">
        <span class="time">{formatTime(playback?.currentTime || 0)}</span>
        <div
          class="timeline-bar"
          on:click={handleTimelineClick}
          on:keydown={(e) => { if (e.key === 'ArrowLeft') audioEngine.seek(Math.max(0, (playback?.currentTime||0) - 5)); if (e.key === 'ArrowRight') audioEngine.seek(Math.min(playback?.duration||0, (playback?.currentTime||0) + 5)); }}
          role="slider"
          aria-label="Playback position"
          aria-valuenow={Math.round(playback?.currentTime || 0)}
          aria-valuemin={0}
          aria-valuemax={Math.round(playback?.duration || 0)}
          tabindex="0"
        >
          <div
            class="timeline-progress"
            style={`width: ${((playback?.currentTime || 0) / (playback?.duration || 1)) * 100}%`}
          ></div>
        </div>
        <span class="time">{formatTime(playback?.duration || 0)}</span>
      </div>

      <div class="master-control">
        <label for="master-volume">Master Volume</label>
        <div class="volume-slider">
          <input
            id="master-volume"
            type="range"
            min="0"
            max="100"
            value={Math.round((playback?.masterVolume || 1) * 100)}
            on:change={handleMasterVolumeChange}
            class="slider"
          />
          <span class="value">{Math.round((playback?.masterVolume || 1) * 100)}%</span>
        </div>
      </div>
    </section>

    <!-- Navigation & Content -->
    <div class="editor-main">
      <!-- Sidebar Navigation -->
      <Sidebar {activeView} on:navigate={(e) => (activeView = e.detail.view)} />

      <!-- Main Content Area -->
      <div class="content-area">
        <!-- Top Bar with Jobs & Health -->
        <div class="top-bar">
          <div class="top-bar-left">
            <!-- View title -->
            {#if activeView === 'library'}
              <h2>Library</h2>
            {:else if activeView === 'import'}
              <h2>Import</h2>
            {:else if activeView === 'collections'}
              <h2>Collections</h2>
            {:else if activeView === 'koala'}
              <h2>Koala Kit</h2>
            {:else if activeView === 'sp404'}
              <h2>SP-404 MK2</h2>
            {:else if activeView === 'settings'}
              <h2>Settings</h2>
            {:else if activeView === 'wave-editor'}
              <h2>Wave Editor</h2>
            {/if}
          </div>
          <div class="top-bar-right">
            <div class="panel-container">
              <JobsPanel />
            </div>
            <div class="panel-container">
              <HealthPanel />
            </div>
          </div>
        </div>

        <!-- View Content -->
        <div class="view-content">
          {#if activeView === 'library'}
            <LibraryView on:edit={handleLibraryEdit} on:preview={handleLibraryPreview} />
          {:else if activeView === 'import'}
            <ImportView />
          {:else if activeView === 'collections'}
            <CollectionsView />
          {:else if activeView === 'koala'}
            <KoalaKitBuilder />
          {:else if activeView === 'sp404'}
            <SP404KitBuilder />
          {:else if activeView === 'settings'}
            <div class="settings-view">
              <HealthPanel />
              <div class="audio-settings">
                <h3>Audio Settings</h3>
                <p>Audio configuration coming soon...</p>
              </div>
            </div>
          {:else if activeView === 'wave-editor'}
            <WaveEditor filePath={selectedFilePath || ''} fileName={selectedFileName || ''} />
          {/if}
        </div>
      </div>
    </div>

    <!-- Audio Preview Bar -->
    <AudioPreview filePath={previewFilePath} fileName={previewFileName} />
  </div>
</div>
{/if}

{#if youtubeModal}
  <YouTubeImportModal
    trackId={youtubeModal.trackId}
    trackName={youtubeModal.trackName}
    on:imported={handleYouTubeImported}
    on:close={() => (youtubeModal = null)}
  />
{/if}

{#if showExportModal && project}
  <div class="modal-overlay" on:click|self={() => (showExportModal = false)} role="dialog" aria-modal="true" tabindex="-1" on:keydown={(e) => { if (e.key === 'Escape') showExportModal = false; }}>
    <ExportModal
      projectName={project.name}
      {tracks}
      duration={playback?.duration ?? 0}
      on:close={() => (showExportModal = false)}
      on:exported={() => (showExportModal = false)}
    />
  </div>
{/if}

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
    color: #e0e0e0;
  }

  .editor-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 2rem;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .export-project-btn {
    padding: 0.5rem 1rem;
    background: #cba6f7;
    color: #1e1e2e;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .export-project-btn:hover {
    background: #b48bdf;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .header-left h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.8rem;
  }

  .meta {
    color: #a0a0a0;
    font-size: 0.9rem;
  }

  .editor-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 1.5rem;
  }

  .editor-main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    gap: 16px;
  }

  .top-bar-left {
    flex: 1;
  }

  .top-bar-left h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .top-bar-right {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .panel-container {
    width: 300px;
    max-height: 200px;
    overflow-y: auto;
  }

  .view-content {
    flex: 1;
    overflow: hidden;
  }

  .settings-view {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    overflow-y: auto;
    height: 100%;
  }

  .audio-settings {
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }

  .audio-settings h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .audio-settings p {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  .transport {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .transport-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .timeline {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .time {
    font-size: 0.9rem;
    font-family: 'Monaco', monospace;
    min-width: 50px;
  }

  .timeline-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
  }

  .timeline-progress {
    height: 100%;
    background: linear-gradient(45deg, #6366f1, #8b5cf6);
    transition: width 0.1s linear;
  }

  .master-control {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .master-control label {
    min-width: 100px;
  }

  .volume-slider {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    max-width: 300px;
  }

  .slider {
    flex: 1;
    cursor: pointer;
  }

  .value {
    min-width: 40px;
    text-align: right;
  }

  .edit-area {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    overflow: hidden;
  }

  .arrange,
  .mixer {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .arrange-header,
  .mixer h2 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    margin-top: 0;
  }

  .tracks-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .track-row {
    display: grid;
    grid-template-columns: 20px 100px 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: border-color 0.15s, background 0.15s;
    cursor: grab;
  }

  .track-row:active {
    cursor: grabbing;
  }

  .track-row.drag-over {
    border-color: rgba(99, 102, 241, 0.7);
    background: rgba(99, 102, 241, 0.1);
  }

  .drag-handle {
    color: rgba(255, 255, 255, 0.25);
    font-size: 0.85rem;
    cursor: grab;
    user-select: none;
    letter-spacing: -2px;
  }

  .drag-handle:hover {
    color: rgba(255, 255, 255, 0.5);
  }

  .track-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .track-info h3 {
    margin: 0;
  }

  .track-name {
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 3px;
    margin: -1px -3px;
  }

  .track-name:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .track-name-input {
    font-size: 0.9rem;
    font-weight: 600;
    background: var(--bg-tertiary, #252540);
    border: 1px solid rgba(99, 102, 241, 0.6);
    border-radius: 3px;
    color: inherit;
    padding: 1px 4px;
    width: 100%;
    outline: none;
  }

  .track-waveform {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .audio-badge {
    font-size: 0.75rem;
    color: #6366f1;
    font-weight: 500;
  }

  .no-audio {
    font-size: 0.7rem;
    color: #505060;
    font-style: italic;
  }

  .control-btn.load:hover {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.4);
  }

  .control-btn.yt:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .undo-btn {
    padding: 0.4rem 0.75rem;
    background: #313244;
    color: #cdd6f4;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .undo-btn:hover:not(:disabled) {
    background: #45475a;
  }

  .undo-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .transport-divider {
    width: 1px;
    height: 28px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 0.25rem;
    align-self: center;
  }

  .metro-btn,
  .tap-btn {
    padding: 0.5rem 0.9rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e0e0e0;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.15s;
    background: rgba(255, 255, 255, 0.05);
  }

  .metro-btn.active {
    background: rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.7);
    color: #a5b4fc;
  }

  .metro-btn:hover { background: rgba(255, 255, 255, 0.1); }

  .tap-btn:hover { background: rgba(139, 92, 246, 0.3); border-color: rgba(139, 92, 246, 0.5); }
  .tap-btn:active { transform: scale(0.95); }

  .track-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    padding: 0.4rem 0.8rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: #e0e0e0;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .control-btn.active {
    background: rgba(99, 102, 241, 0.5);
    border-color: rgba(99, 102, 241, 0.8);
  }

  .control-btn.delete:hover {
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }

  .control-btn.record-btn {
    color: #ff4444;
  }

  .control-btn.record-btn.recording {
    background: rgba(255, 68, 68, 0.3);
    border-color: rgba(255, 68, 68, 0.8);
    animation: pulse-rec 1s ease-in-out infinite;
  }

  @keyframes pulse-rec {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .mixer-channels {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    min-height: 300px;
  }
</style>

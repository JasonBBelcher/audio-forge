<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { Midi } from '@tonejs/midi';

  interface MidiFileInfo {
    id: number;
    name: string;
    file_path: string;
    file_size: number;
    tempo: number;
    timeSignature: string;
    trackCount: number;
    noteCount: number;
    durationSec: number;
    format: number;
    tags?: string[];
    created_at?: string;
  }

  interface MidiNote {
    pitch: number;
    time: number;
    duration: number;
  }

  let midiFiles: MidiFileInfo[] = [];
  let filteredFiles: MidiFileInfo[] = [];
  let loading = false;
  let error: string | null = null;
  let searchQuery = '';

  let selectedMidi: MidiFileInfo | null = null;
  let newTags: string = '';
  let linkedAssetIds: number[] = [];

  let sortColumn: 'name' | 'tempo' | 'timeSignature' | 'trackCount' | 'durationSec' = 'name';
  let sortDir: 'asc' | 'desc' = 'asc';

  let unsubscribers: Array<() => void> = [];

  // Piano roll state
  let canvas: HTMLCanvasElement | null = null;
  let midiNotes: MidiNote[] = [];
  let midiDuration: number = 0;
  let minPitch: number = 0;
  let maxPitch: number = 127;

  // Playback state
  let isPlaying = false;
  let currentTime = 0;
  let audioContext: AudioContext | null = null;
  let playbackStartTime = 0;
  let playbackFrameId: number | null = null;
  let activeOscillators: OscillatorNode[] = [];
  let activeGains: GainNode[] = [];

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDuration(secs: number): string {
    const mins = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${mins}:${sec.toString().padStart(2, '0')}`;
  }

  function getSortArrow(col: typeof sortColumn): string {
    if (sortColumn !== col) return '';
    return sortDir === 'asc' ? '▲' : '▼';
  }

  function applyFiltersAndSort(): void {
    let result = midiFiles;

    // Search filter
    if (searchQuery.trim()) {
      result = result.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'tempo':
          aVal = a.tempo;
          bVal = b.tempo;
          break;
        case 'timeSignature':
          aVal = a.timeSignature;
          bVal = b.timeSignature;
          break;
        case 'trackCount':
          aVal = a.trackCount;
          bVal = b.trackCount;
          break;
        case 'durationSec':
          aVal = a.durationSec;
          bVal = b.durationSec;
          break;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    filteredFiles = result;
  }

  function handleColumnClick(col: typeof sortColumn): void {
    if (sortColumn === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDir = 'asc';
    }
    applyFiltersAndSort();
  }

  function handleSearchInput(e: Event): void {
    searchQuery = (e.target as HTMLInputElement).value;
    applyFiltersAndSort();
  }

  async function handleRowClick(midi: MidiFileInfo): Promise<void> {
    selectedMidi = midi;
    newTags = midi.tags?.join(', ') || '';
    loadLinkedAssets(midi.id);

    // Load and parse MIDI file
    try {
      const af = (window as any).audioforge;
      const arrayBuffer = await af.files.readAsArrayBuffer(midi.file_path);
      const midiFile = new Midi(arrayBuffer);

      // Extract all notes from all tracks
      const notes: MidiNote[] = [];
      for (const track of midiFile.tracks) {
        for (const note of track.notes) {
          notes.push({
            pitch: note.midi,
            time: note.time,
            duration: note.duration
          });
        }
      }

      midiNotes = notes;
      midiDuration = midiFile.duration;

      // Calculate min/max pitch
      if (notes.length > 0) {
        const pitches = notes.map(n => n.pitch);
        minPitch = Math.max(0, Math.min(...pitches) - 5);
        maxPitch = Math.min(127, Math.max(...pitches) + 5);
      }

      currentTime = 0;
      if (isPlaying) {
        stopPlayback();
      }
    } catch (e) {
      console.error('Failed to load MIDI file:', e);
    }
  }

  async function loadLinkedAssets(midiId: number): Promise<void> {
    try {
      const af = (window as any).audioforge;
      linkedAssetIds = await af.midi?.getAssetsForMidi?.(midiId) ?? [];
    } catch (e) {
      console.error('Failed to load linked assets:', e);
    }
  }

  async function handleImportClick(): Promise<void> {
    try {
      const af = (window as any).audioforge;
      const result = await af.midi?.showImportDialog?.();

      if (result && !result.canceled && result.filePaths.length > 0) {
        loading = true;
        const imported = await af.midi?.import?.(result.filePaths);

        if (imported && imported.length > 0) {
          midiFiles = [...midiFiles, ...imported];
          applyFiltersAndSort();
        }
      }
    } catch (e: any) {
      error = e?.message || 'Failed to import MIDI files';
    } finally {
      loading = false;
    }
  }

  async function handleDeleteClick(): Promise<void> {
    if (!selectedMidi) return;

    const confirmed = confirm(`Delete "${selectedMidi.name}"?`);
    if (!confirmed) return;

    try {
      const af = (window as any).audioforge;
      await af.midi?.delete?.(selectedMidi.id);

      midiFiles = midiFiles.filter((m) => m.id !== selectedMidi!.id);
      applyFiltersAndSort();
      selectedMidi = null;
    } catch (e) {
      console.error('Failed to delete MIDI:', e);
    }
  }

  async function handleSaveTags(): Promise<void> {
    if (!selectedMidi) return;

    try {
      const af = (window as any).audioforge;
      const tags = newTags.split(',').map((t) => t.trim()).filter((t) => t);
      await af.midi?.updateTags?.(selectedMidi.id, tags);

      // Update local state
      const idx = midiFiles.findIndex((m) => m.id === selectedMidi!.id);
      if (idx >= 0) {
        midiFiles[idx].tags = tags;
        midiFiles = midiFiles; // Trigger reactivity
      }
    } catch (e) {
      console.error('Failed to save tags:', e);
    }
  }

  async function handleLinkAsset(): Promise<void> {
    if (!selectedMidi) return;

    const assetId = prompt('Enter asset ID to link:');
    if (!assetId) return;

    try {
      const af = (window as any).audioforge;
      await af.midi?.linkToAsset?.(selectedMidi.id, parseInt(assetId, 10));
      linkedAssetIds = [parseInt(assetId, 10), ...linkedAssetIds];
    } catch (e) {
      console.error('Failed to link asset:', e);
    }
  }

  async function handleUnlinkAsset(assetId: number): Promise<void> {
    if (!selectedMidi) return;

    try {
      const af = (window as any).audioforge;
      await af.midi?.unlinkFromAsset?.(selectedMidi.id, assetId);
      linkedAssetIds = linkedAssetIds.filter((id) => id !== assetId);
    } catch (e) {
      console.error('Failed to unlink asset:', e);
    }
  }

  function drawPianoRoll(): void {
    if (!canvas || !selectedMidi) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const pitchRange = maxPitch - minPitch + 1;

    // Clear canvas
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw middle C line (pitch 60)
    if (minPitch <= 60 && 60 <= maxPitch) {
      const yPos = ((maxPitch - 60) / pitchRange) * canvasHeight;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(canvasWidth, yPos);
      ctx.stroke();
    }

    // Draw notes
    ctx.fillStyle = 'rgba(100, 181, 246, 0.8)';
    for (const note of midiNotes) {
      const x = (note.time / midiDuration) * canvasWidth;
      const width = (note.duration / midiDuration) * canvasWidth;
      const y = ((maxPitch - note.pitch) / pitchRange) * canvasHeight;
      const height = (1 / pitchRange) * canvasHeight;

      if (width > 0 && height > 0) {
        ctx.fillRect(x, y, Math.max(width, 1), Math.max(height, 1));
      }
    }

    // Draw current time indicator
    if (isPlaying && midiDuration > 0) {
      const xPos = (currentTime / midiDuration) * canvasWidth;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvasHeight);
      ctx.stroke();
    }
  }

  function startPlayback(): void {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    isPlaying = true;
    playbackStartTime = audioContext.currentTime - currentTime;

    // Schedule all notes
    for (const note of midiNotes) {
      const startTime = playbackStartTime + note.time;
      const endTime = startTime + note.duration;

      // Create oscillator and gain
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);

      // Envelope: ramp up over 10ms, ramp down over 50ms
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, endTime - 0.05);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(startTime);
      osc.stop(endTime);

      activeOscillators.push(osc);
      activeGains.push(gain);
    }

    // Update playback position
    updatePlaybackPosition();
  }

  function stopPlayback(): void {
    isPlaying = false;

    // Stop all oscillators
    for (const osc of activeOscillators) {
      try {
        osc.stop();
      } catch (e) {
        // Already stopped
      }
    }

    activeOscillators = [];
    activeGains = [];

    if (playbackFrameId !== null) {
      cancelAnimationFrame(playbackFrameId);
      playbackFrameId = null;
    }

    // Redraw canvas to clear playback line
    if (canvas) {
      drawPianoRoll();
    }
  }

  function updatePlaybackPosition(): void {
    if (!audioContext || !isPlaying) return;

    currentTime = audioContext.currentTime - playbackStartTime;

    // Clamp to duration
    if (currentTime >= midiDuration) {
      stopPlayback();
      currentTime = 0;
      return;
    }

    // Redraw canvas with updated position
    if (canvas) {
      drawPianoRoll();
    }

    playbackFrameId = requestAnimationFrame(updatePlaybackPosition);
  }

  function togglePlayback(): void {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  onMount(async () => {
    loading = true;
    error = null;

    try {
      const af = (window as any).audioforge;
      if (!af?.midi?.list) {
        error = 'AudioForge API not available';
        loading = false;
        return;
      }

      midiFiles = await af.midi.list();
      applyFiltersAndSort();

      // Subscribe to library updates
      if (af?.on) {
        const unsub = af.on('library:midiAdded', async () => {
          try {
            midiFiles = await af.midi.list();
            applyFiltersAndSort();
          } catch (e) {
            console.error('Failed to refresh MIDI files:', e);
          }
        });
        if (unsub) {
          unsubscribers.push(unsub);
        }
      }
    } catch (e: any) {
      error = e?.message || 'Failed to load MIDI files';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    unsubscribers.forEach((unsub) => unsub());
    if (isPlaying) {
      stopPlayback();
    }
    if (audioContext) {
      audioContext.close();
    }
  });

  afterUpdate(() => {
    if (selectedMidi && canvas) {
      drawPianoRoll();
    }
  });
</script>

<div class="midi-library-view">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="search-box">
      <span class="search-icon">#</span>
      <input
        type="text"
        placeholder="Search MIDI files..."
        value={searchQuery}
        oninput={handleSearchInput}
      />
    </div>

    <button class="import-btn" disabled={loading} onclick={handleImportClick}>
      {#if loading}
        <span class="spinner"></span>
        Importing...
      {:else}
        Import MIDI
      {/if}
    </button>
  </div>

  <div class="main-content">
    <!-- Table -->
    <div class="table-container">
      {#if loading && midiFiles.length === 0}
        <div class="loading">Loading MIDI files...</div>
      {:else if error}
        <div class="error">Error: {error}</div>
      {:else if filteredFiles.length === 0}
        <div class="empty-state">
          {#if midiFiles.length === 0}
            <p>No MIDI files imported yet</p>
          {:else}
            <p>No MIDI files match your search</p>
          {/if}
        </div>
      {:else}
        <table>
          <thead>
            <tr>
              <th
                class="col-name"
                role="columnheader"
                onclick={() => handleColumnClick('name')}
              >
                Name {getSortArrow('name')}
              </th>
              <th
                class="col-tempo"
                role="columnheader"
                onclick={() => handleColumnClick('tempo')}
              >
                BPM {getSortArrow('tempo')}
              </th>
              <th
                class="col-timesig"
                role="columnheader"
                onclick={() => handleColumnClick('timeSignature')}
              >
                Time Sig {getSortArrow('timeSignature')}
              </th>
              <th
                class="col-tracks"
                role="columnheader"
                onclick={() => handleColumnClick('trackCount')}
              >
                Tracks {getSortArrow('trackCount')}
              </th>
              <th class="col-notes">Notes</th>
              <th
                class="col-duration"
                role="columnheader"
                onclick={() => handleColumnClick('durationSec')}
              >
                Duration {getSortArrow('durationSec')}
              </th>
              <th class="col-size">Size</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredFiles as midi (midi.id)}
              <tr onclick={() => handleRowClick(midi)}>
                <td class="col-name">{midi.name}</td>
                <td class="col-tempo">{midi.tempo}</td>
                <td class="col-timesig">{midi.timeSignature}</td>
                <td class="col-tracks">{midi.trackCount}</td>
                <td class="col-notes">{midi.noteCount}</td>
                <td class="col-duration">{formatDuration(midi.durationSec)}</td>
                <td class="col-size">{formatFileSize(midi.file_size)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <!-- Detail Panel -->
    {#if selectedMidi}
      <div class="detail-panel">
        <div class="detail-header">
          <h3>{selectedMidi.name}</h3>
          <button class="close-btn" onclick={() => (selectedMidi = null)}>×</button>
        </div>

        <!-- Piano Roll Section (Fixed Top) -->
        <div class="piano-roll-section">
          <canvas
            bind:this={canvas}
            width={276}
            height={160}
            class="piano-roll-canvas"
          ></canvas>

          <!-- Transport Controls -->
          <div class="transport-bar">
            <button
              class="play-btn"
              onclick={togglePlayback}
              title={isPlaying ? 'Stop' : 'Play'}
            >
              {isPlaying ? '⏹' : '▶'}
            </button>

            <div class="time-display">
              {formatDuration(currentTime)} / {formatDuration(midiDuration)}
            </div>

            <!-- Progress Bar -->
            <div class="progress-bar-container">
              <div
                class="progress-bar-fill"
                style="width: {midiDuration > 0 ? (currentTime / midiDuration) * 100 : 0}%"
              ></div>
            </div>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="detail-content">
          <!-- Metadata -->
          <div class="metadata-section">
            <h4>Metadata</h4>
            <div class="metadata-table">
              <div class="metadata-row">
                <span>Tempo</span>
                <span>{selectedMidi.tempo} BPM</span>
              </div>
              <div class="metadata-row">
                <span>Time Signature</span>
                <span>{selectedMidi.timeSignature}</span>
              </div>
              <div class="metadata-row">
                <span>Tracks</span>
                <span>{selectedMidi.trackCount}</span>
              </div>
              <div class="metadata-row">
                <span>Notes</span>
                <span>{selectedMidi.noteCount}</span>
              </div>
              <div class="metadata-row">
                <span>Duration</span>
                <span>{formatDuration(selectedMidi.durationSec)}</span>
              </div>
              <div class="metadata-row">
                <span>Format</span>
                <span>Format {selectedMidi.format}</span>
              </div>
              <div class="metadata-row">
                <span>File Size</span>
                <span>{formatFileSize(selectedMidi.file_size)}</span>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div class="tags-section">
            <h4>Tags</h4>
            <div class="tags-input">
              <input
                type="text"
                placeholder="Comma-separated tags"
                value={newTags}
                onchange={(e) => (newTags = (e.target as HTMLInputElement).value)}
              />
              <button onclick={handleSaveTags}>Save</button>
            </div>
            {#if selectedMidi.tags && selectedMidi.tags.length > 0}
              <div class="tags-list">
                {#each selectedMidi.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Linked Assets -->
          <div class="assets-section">
            <h4>Linked Assets</h4>
            <div class="link-input">
              <button onclick={handleLinkAsset}>Link Asset</button>
            </div>
            {#if linkedAssetIds.length > 0}
              <div class="assets-list">
                {#each linkedAssetIds as assetId}
                  <div class="asset-item">
                    <span>Asset {assetId}</span>
                    <button
                      class="unlink-btn"
                      onclick={() => handleUnlinkAsset(assetId)}
                    >
                      ×
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="no-assets">No linked assets</p>
            {/if}
          </div>

          <!-- Delete -->
          <div class="delete-section">
            <button class="delete-btn" onclick={handleDeleteClick}>Delete MIDI File</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .midi-library-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(255, 255, 255, 0.02);
    color: rgba(255, 255, 255, 0.9);
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 12px;
    gap: 8px;
  }

  .search-icon {
    font-size: 14px;
    opacity: 0.6;
  }

  .search-box input {
    flex: 1;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    outline: none;
  }

  .search-box input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .import-btn {
    padding: 6px 12px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 4px;
    color: #64b5f6;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .import-btn:hover:not(:disabled) {
    background: rgba(100, 181, 246, 0.3);
    border-color: rgba(100, 181, 246, 0.6);
  }

  .import-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 1.5px solid rgba(100, 181, 246, 0.3);
    border-top-color: #64b5f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: 12px;
    padding: 12px;
  }

  .table-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
  }

  .loading,
  .error,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  .error {
    color: #ff6b6b;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  thead {
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    position: sticky;
    top: 0;
  }

  th {
    padding: 10px 12px;
    text-align: left;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    user-select: none;
    cursor: pointer;
    white-space: nowrap;
  }

  th:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  tbody tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background-color 0.15s ease;
    cursor: pointer;
  }

  tbody tr:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  td {
    padding: 8px 12px;
    color: rgba(255, 255, 255, 0.8);
  }

  .col-name {
    flex: 1;
    min-width: 200px;
  }

  .col-tempo,
  .col-timesig,
  .col-tracks,
  .col-notes,
  .col-duration {
    width: 80px;
    text-align: center;
  }

  .col-size {
    width: 80px;
    text-align: right;
  }

  .detail-panel {
    width: 300px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .detail-header h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    word-break: break-all;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
  }

  .close-btn:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .piano-roll-section {
    flex-shrink: 0;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .piano-roll-canvas {
    width: 100%;
    height: 160px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    background: #0d0d0d;
    display: block;
  }

  .transport-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .play-btn {
    padding: 4px 8px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 3px;
    color: #64b5f6;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .play-btn:hover {
    background: rgba(100, 181, 246, 0.3);
  }

  .time-display {
    min-width: 50px;
    text-align: right;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .progress-bar-container {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: #64b5f6;
    transition: width 0.05s linear;
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .metadata-section h4,
  .tags-section h4,
  .assets-section h4 {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.6);
  }

  .metadata-table {
    width: 100%;
    font-size: 11px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .metadata-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .metadata-row span:first-child {
    color: rgba(255, 255, 255, 0.6);
    min-width: 70px;
  }

  .tags-input {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .tags-input input {
    flex: 1;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 10px;
  }

  .tags-input button {
    padding: 4px 8px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 3px;
    color: #64b5f6;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .tags-input button:hover {
    background: rgba(100, 181, 246, 0.3);
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag {
    display: inline-block;
    padding: 2px 6px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 3px;
    color: #64b5f6;
    font-size: 10px;
  }

  .link-input {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .link-input button {
    flex: 1;
    padding: 4px 8px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 3px;
    color: #64b5f6;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .link-input button:hover {
    background: rgba(100, 181, 246, 0.3);
  }

  .assets-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .asset-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 3px;
    font-size: 11px;
  }

  .unlink-btn {
    background: none;
    border: none;
    color: #ff6b6b;
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
  }

  .unlink-btn:hover {
    color: #ff8a8a;
  }

  .no-assets {
    margin: 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .delete-section {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .delete-btn {
    width: 100%;
    padding: 6px 8px;
    background: rgba(255, 107, 107, 0.2);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 4px;
    color: #ff6b6b;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .delete-btn:hover {
    background: rgba(255, 107, 107, 0.3);
  }
</style>

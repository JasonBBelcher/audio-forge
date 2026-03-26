<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface LoopPoint {
    startSec: number;
    endSec: number;
    durationSec: number;
    confidence: number;
    bars: number;
    bpm?: number;
  }

  interface LibraryAsset {
    id: number;
    name: string;
    file_path: string;
    bpm?: number;
    key?: string;
  }

  export let filePath: string = '';

  const af = (window as any).audioforge;

  // ── State ────────────────────────────────────────────────────────────────
  let selectedFilePath = filePath;
  let selectedFileName = filePath ? filePath.split('/').pop() ?? '' : '';
  let libraryAssets: LibraryAsset[] = [];
  let bpm: number | undefined = undefined;
  let loops: LoopPoint[] = [];
  let selectedLoopIdx = 0;
  let isDetecting = false;
  let isExtracting = false;
  let extractedPath = '';
  let error = '';

  // Audio preview state
  let audioCtx: AudioContext | null = null;
  let activeSource: AudioBufferSourceNode | null = null;
  let previewingIdx: number | null = null;
  let decodedBuffer: AudioBuffer | null = null;
  let loadingPreview = false;

  // ── Lifecycle ────────────────────────────────────────────────────────────
  onMount(async () => {
    await loadLibrary();
    if (selectedFilePath) {
      const asset = libraryAssets.find((a) => a.file_path === selectedFilePath);
      if (asset?.bpm) bpm = asset.bpm;
    }
  });

  onDestroy(() => {
    stopPreview();
    audioCtx?.close();
  });

  // Keep in sync if parent changes the prop
  $: if (filePath && filePath !== selectedFilePath) {
    selectedFilePath = filePath;
    selectedFileName = filePath.split('/').pop() ?? '';
    loops = [];
    decodedBuffer = null;
    bpm = libraryAssets.find((a) => a.file_path === filePath)?.bpm;
  }

  // ── Library ───────────────────────────────────────────────────────────────
  async function loadLibrary() {
    try {
      libraryAssets = (await af.files.list()) ?? [];
    } catch {
      libraryAssets = [];
    }
  }

  function selectAsset(asset: LibraryAsset) {
    selectedFilePath = asset.file_path;
    selectedFileName = asset.name;
    loops = [];
    extractedPath = '';
    error = '';
    decodedBuffer = null;
    stopPreview();
    if (asset.bpm) bpm = asset.bpm;
  }

  async function handleBrowse() {
    try {
      const result = await af.files.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a', 'aac'] }],
        title: 'Select an audio file',
      });
      if (result.canceled || !result.filePaths?.length) return;
      selectedFilePath = result.filePaths[0];
      selectedFileName = selectedFilePath.split('/').pop() ?? selectedFilePath;
      loops = [];
      extractedPath = '';
      error = '';
      decodedBuffer = null;
      stopPreview();
    } catch (e: any) {
      error = e?.message ?? 'Failed to open file';
    }
  }

  // ── Detection ─────────────────────────────────────────────────────────────
  async function detectLoops() {
    if (!selectedFilePath) {
      error = 'Select a file first';
      return;
    }
    isDetecting = true;
    error = '';
    loops = [];
    extractedPath = '';
    decodedBuffer = null;
    stopPreview();

    try {
      const result = await af.loop.detect(selectedFilePath, bpm || undefined);
      if (result) {
        loops = result.loops ?? [];
        if (result.suggestedBpm) bpm = result.suggestedBpm;
        selectedLoopIdx = 0;
      }
      if (loops.length === 0) error = 'No loop candidates found — try a longer file or different BPM.';
    } catch (e: any) {
      error = `Detection failed: ${e?.message ?? 'Unknown error'}`;
    } finally {
      isDetecting = false;
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  async function ensureDecoded(): Promise<AudioBuffer | null> {
    if (decodedBuffer) return decodedBuffer;
    loadingPreview = true;
    try {
      const rawBuffer: ArrayBuffer = await af.files.readAsArrayBuffer(selectedFilePath);
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext();
      }
      decodedBuffer = await audioCtx!.decodeAudioData(rawBuffer);
      return decodedBuffer;
    } catch (e: any) {
      error = `Preview failed: ${e?.message ?? 'Could not decode audio'}`;
      return null;
    } finally {
      loadingPreview = false;
    }
  }

  async function togglePreview(idx: number) {
    const loop = loops[idx];
    if (!loop) return;

    // Stop current preview
    if (previewingIdx === idx) {
      stopPreview();
      return;
    }
    stopPreview();

    const buf = await ensureDecoded();
    if (!buf) return;

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext();
    }

    const sr = buf.sampleRate;
    const startSample = Math.floor(loop.startSec * sr);
    const endSample = Math.min(Math.floor(loop.endSec * sr), buf.length);
    const numSamples = endSample - startSample;
    if (numSamples <= 0) return;

    // Slice the relevant region into its own buffer
    const loopBuf = audioCtx!.createBuffer(buf.numberOfChannels, numSamples, sr);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      loopBuf.getChannelData(ch).set(buf.getChannelData(ch).subarray(startSample, endSample));
    }

    const source = audioCtx!.createBufferSource();
    source.buffer = loopBuf;
    source.loop = true;
    source.connect(audioCtx!.destination);
    source.start();
    source.onended = () => {
      if (previewingIdx === idx) previewingIdx = null;
    };

    activeSource = source;
    previewingIdx = idx;
  }

  function stopPreview() {
    try { activeSource?.stop(); } catch {}
    activeSource = null;
    previewingIdx = null;
  }

  // ── Extraction ────────────────────────────────────────────────────────────
  async function extractLoop() {
    const loop = loops[selectedLoopIdx];
    if (!loop || !selectedFilePath) return;

    isExtracting = true;
    error = '';
    extractedPath = '';
    stopPreview();

    try {
      const outPath: string = await af.loop.extract(selectedFilePath, loop);
      extractedPath = outPath;

      // Auto-import the extracted loop into the library
      await af.files.import([outPath]);
      await loadLibrary();
    } catch (e: any) {
      error = `Extraction failed: ${e?.message ?? 'Unknown error'}`;
    } finally {
      isExtracting = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const rem = (s % 60).toFixed(2).padStart(5, '0');
    return `${m}:${rem}`;
  }

  function barLabel(bars: number): string {
    return bars === 1 ? '1-bar' : bars === 2 ? '2-bar' : bars === 4 ? '4-bar' : '8-bar';
  }

  function confidenceColor(c: number): string {
    if (c >= 0.9) return '#81c784';
    if (c >= 0.75) return '#ffb74d';
    return '#ef9a9a';
  }

  function extractedFileName(p: string): string {
    return p.split('/').pop() ?? p;
  }
</script>

<div class="loop-view">
  <!-- ── Left panel: file picker + library ───────────────────── -->
  <div class="left-panel">
    <div class="panel-header">Source File</div>

    <button class="browse-btn" onclick={handleBrowse}>Browse…</button>

    {#if selectedFilePath}
      <div class="selected-file" title={selectedFilePath}>
        <span class="file-icon">🎵</span>
        <span class="file-name">{selectedFileName}</span>
      </div>
    {/if}

    <div class="divider"></div>
    <div class="panel-sub-header">Library</div>

    <div class="asset-list">
      {#each libraryAssets as asset (asset.id)}
        <button
          class="asset-row"
          class:active={asset.file_path === selectedFilePath}
          onclick={() => selectAsset(asset)}
        >
          <span class="asset-name" title={asset.name}>{asset.name}</span>
          {#if asset.bpm}
            <span class="asset-bpm">{asset.bpm}</span>
          {/if}
        </button>
      {/each}

      {#if libraryAssets.length === 0}
        <div class="empty-lib">No files in library yet</div>
      {/if}
    </div>
  </div>

  <!-- ── Right panel: detection + results ────────────────────── -->
  <div class="right-panel">
    <!-- Controls -->
    <div class="controls-row">
      <div class="bpm-field">
        <label for="bpm-input">BPM</label>
        <input
          id="bpm-input"
          type="number"
          bind:value={bpm}
          min="40"
          max="300"
          placeholder="Auto"
          disabled={isDetecting}
        />
        <span class="hint">(leave blank to auto-detect)</span>
      </div>

      <button
        class="detect-btn"
        onclick={detectLoops}
        disabled={isDetecting || !selectedFilePath}
      >
        {#if isDetecting}
          <span class="spinner"></span> Detecting…
        {:else}
          🔁 Detect Loops
        {/if}
      </button>
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    <!-- Results -->
    {#if loops.length > 0}
      <div class="results-section">
        <div class="results-header">
          Loop Candidates
          <span class="bpm-chip">{bpm} BPM</span>
        </div>

        <div class="loop-list">
          {#each loops as loop, idx (idx)}
            {@const isSelected = selectedLoopIdx === idx}
            {@const isPreviewing = previewingIdx === idx}
            <div
              class="loop-row"
              class:selected={isSelected}
              role="button"
              tabindex="0"
              onclick={() => { selectedLoopIdx = idx; }}
              onkeydown={(e) => e.key === 'Enter' && (selectedLoopIdx = idx)}
            >
              <input
                type="radio"
                name="loop-select"
                value={idx}
                bind:group={selectedLoopIdx}
                id="loop-{idx}"
              />

              <div class="loop-info">
                <div class="loop-top">
                  <span class="bar-label">{barLabel(loop.bars)}</span>
                  <span class="loop-time">{formatTime(loop.startSec)} → {formatTime(loop.endSec)}</span>
                  <span class="loop-dur">{loop.durationSec.toFixed(2)}s</span>
                </div>
                <div class="loop-bottom">
                  <div class="confidence-bar">
                    <div
                      class="confidence-fill"
                      style="width:{Math.round(loop.confidence * 100)}%; background:{confidenceColor(loop.confidence)}"
                    ></div>
                  </div>
                  <span class="confidence-pct" style="color:{confidenceColor(loop.confidence)}">
                    {Math.round(loop.confidence * 100)}%
                  </span>
                </div>
              </div>

              <button
                class="preview-btn"
                class:previewing={isPreviewing}
                onclick={(e) => { e.stopPropagation(); togglePreview(idx); }}
                disabled={loadingPreview}
                title={isPreviewing ? 'Stop preview' : 'Preview loop'}
              >
                {isPreviewing ? '⏹' : '▶'}
              </button>
            </div>
          {/each}
        </div>

        <button
          class="extract-btn"
          onclick={extractLoop}
          disabled={isExtracting}
        >
          {#if isExtracting}
            <span class="spinner"></span> Extracting…
          {:else}
            ✂ Extract {barLabel(loops[selectedLoopIdx]?.bars ?? 1)} Loop
          {/if}
        </button>
      </div>
    {:else if !isDetecting && selectedFilePath}
      <div class="idle-state">
        <div class="idle-icon">🔁</div>
        <p>Press <strong>Detect Loops</strong> to analyse this file.</p>
      </div>
    {:else if !selectedFilePath}
      <div class="idle-state">
        <div class="idle-icon">🎵</div>
        <p>Select a file from your library or browse to get started.</p>
      </div>
    {/if}

    {#if extractedPath}
      <div class="success-banner">
        <span class="success-icon">✓</span>
        <div class="success-text">
          <strong>{extractedFileName(extractedPath)}</strong> extracted and added to your library.
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .loop-view {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: #0f0f1e;
  }

  /* ── Left panel ─────────────────────────────────────────── */
  .left-panel {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 10px;
    overflow: hidden;
  }

  .panel-header {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
  }

  .panel-sub-header {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 4px;
  }

  .browse-btn {
    padding: 7px 12px;
    background: rgba(100, 181, 246, 0.12);
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 6px;
    color: #64b5f6;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
  }

  .browse-btn:hover {
    background: rgba(100, 181, 246, 0.2);
  }

  .selected-file {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(100, 181, 246, 0.08);
    border: 1px solid rgba(100, 181, 246, 0.2);
    border-radius: 6px;
    overflow: hidden;
  }

  .file-icon { font-size: 14px; flex-shrink: 0; }

  .file-name {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 2px 0;
  }

  .asset-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .asset-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s;
    width: 100%;
  }

  .asset-row:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .asset-row.active {
    background: rgba(100, 181, 246, 0.1);
    border-color: rgba(100, 181, 246, 0.3);
  }

  .asset-name {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .asset-bpm {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .empty-lib {
    padding: 12px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }

  /* ── Right panel ────────────────────────────────────────── */
  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 24px;
    overflow-y: auto;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .bpm-field {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .bpm-field label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }

  .bpm-field input {
    width: 72px;
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    text-align: center;
  }

  .bpm-field input:focus {
    outline: none;
    border-color: #64b5f6;
  }

  .bpm-field input::placeholder { color: rgba(255,255,255,0.3); }

  .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
  }

  .detect-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    background: #64b5f6;
    border: none;
    border-radius: 7px;
    color: #000;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .detect-btn:hover:not(:disabled) { background: #7fc3f8; }
  .detect-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .error-banner {
    padding: 10px 14px;
    background: rgba(239, 83, 80, 0.1);
    border: 1px solid rgba(239, 83, 80, 0.3);
    border-radius: 6px;
    color: #ef5350;
    font-size: 13px;
  }

  /* ── Results ─────────────────────────────────────────────── */
  .results-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .results-header {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .bpm-chip {
    padding: 2px 8px;
    background: rgba(100, 181, 246, 0.15);
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 10px;
    font-size: 11px;
    color: #64b5f6;
    font-weight: 700;
  }

  .loop-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .loop-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .loop-row:hover { border-color: rgba(255, 255, 255, 0.15); }

  .loop-row.selected {
    border-color: #64b5f6;
    background: rgba(100, 181, 246, 0.06);
  }

  .loop-row input[type='radio'] { accent-color: #64b5f6; flex-shrink: 0; }

  .loop-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .loop-top {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .bar-label {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    min-width: 44px;
  }

  .loop-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .loop-dur {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .loop-bottom {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .confidence-bar {
    flex: 1;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .confidence-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .confidence-pct {
    font-size: 11px;
    font-weight: 600;
    min-width: 30px;
    text-align: right;
  }

  .preview-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .preview-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .preview-btn.previewing {
    background: rgba(100, 181, 246, 0.15);
    border-color: #64b5f6;
    color: #64b5f6;
  }

  .preview-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .extract-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 0;
    background: rgba(129, 199, 132, 0.15);
    border: 1px solid rgba(129, 199, 132, 0.35);
    border-radius: 8px;
    color: #81c784;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .extract-btn:hover:not(:disabled) {
    background: rgba(129, 199, 132, 0.22);
  }

  .extract-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Idle / success states ───────────────────────────────── */
  .idle-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 48px 24px;
  }

  .idle-icon { font-size: 36px; opacity: 0.5; }
  .idle-state p { margin: 0; font-size: 14px; line-height: 1.6; }
  .idle-state strong { color: rgba(255,255,255,0.6); }

  .success-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(129, 199, 132, 0.1);
    border: 1px solid rgba(129, 199, 132, 0.3);
    border-radius: 8px;
  }

  .success-icon {
    color: #81c784;
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .success-text {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.5;
  }

  .success-text strong { color: rgba(255,255,255,0.9); }

  /* ── Spinner ─────────────────────────────────────────────── */
  .spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(0, 0, 0, 0.3);
    border-top-color: #000;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

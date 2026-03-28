<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface LibraryAsset {
    id: number;
    name: string;
    file_path: string;
    bpm?: number;
  }

  interface ConversionResult {
    midiPath: string;
    noteCount: number;
    durationSec: number;
    estimatedTempo?: number;
  }

  const af = (window as any).audioforge;

  // ── Install state ──────────────────────────────────────────────────────────
  let isInstalled = false;
  let isInstalling = false;
  let installError = '';
  let installJobId: string | null = null;

  // ── File selection ─────────────────────────────────────────────────────────
  let selectedFilePath = '';
  let selectedFileName = '';
  let libraryAssets: LibraryAsset[] = [];

  // ── Settings ───────────────────────────────────────────────────────────────
  let onsetThreshold = 0.5;
  let frameThreshold = 0.3;
  let minimumNoteLength = 58;   // ms
  let minFreq = 32.7;           // C1
  let maxFreq = 1975.5;         // B6
  let useNoMelodia = true;

  // ── Conversion state ───────────────────────────────────────────────────────
  let isConverting = false;
  let progress = 0;
  let progressMsg = '';
  let convertJobId: string | null = null;
  let error = '';
  let result: ConversionResult | null = null;
  let savedToLibrary = false;

  // ── Event subscriptions ────────────────────────────────────────────────────
  let unsubs: Array<() => void> = [];

  onMount(async () => {
    await Promise.all([checkInstalled(), loadLibrary()]);
    subscribeToJobs();
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  async function checkInstalled() {
    try {
      const res = await af.audioToMidi.isInstalled();
      isInstalled = res?.installed ?? false;
    } catch {
      isInstalled = false;
    }
  }

  async function loadLibrary() {
    try {
      libraryAssets = (await af.files.list()) ?? [];
    } catch {
      libraryAssets = [];
    }
  }

  function subscribeToJobs() {
    unsubs.push(
      af.on('job:progress', (data: any) => {
        if (data.jobId === convertJobId || data.jobId === installJobId) {
          progress = Math.min(data.progress ?? 0, 99);
          progressMsg = data.message ?? '';
        }
      })
    );

    unsubs.push(
      af.on('job:complete', (data: any) => {
        if (data.jobId === installJobId) {
          isInstalling = false;
          isInstalled = true;
          installJobId = null;
          installError = '';
        }
        if (data.jobId === convertJobId) {
          isConverting = false;
          progress = 100;
          progressMsg = 'Done!';
          result = data.result ?? null;
          convertJobId = null;
          savedToLibrary = false;
        }
      })
    );

    unsubs.push(
      af.on('job:failed', (data: any) => {
        if (data.jobId === installJobId) {
          isInstalling = false;
          installError = data.error ?? 'Installation failed';
          installJobId = null;
        }
        if (data.jobId === convertJobId) {
          isConverting = false;
          error = data.error ?? 'Conversion failed';
          convertJobId = null;
        }
      })
    );
  }

  // ── Install ────────────────────────────────────────────────────────────────
  async function handleInstall() {
    isInstalling = true;
    installError = '';
    progress = 0;
    try {
      const res = await af.audioToMidi.install();
      installJobId = res?.jobId ?? null;
    } catch (e: any) {
      isInstalling = false;
      installError = e?.message ?? 'Install failed';
    }
  }

  // ── File selection ─────────────────────────────────────────────────────────
  function selectAsset(asset: LibraryAsset) {
    selectedFilePath = asset.file_path;
    selectedFileName = asset.name;
    result = null;
    error = '';
    savedToLibrary = false;
  }

  async function handleBrowse() {
    try {
      const res = await af.files.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a', 'aac'] }],
      });
      if (res.canceled || !res.filePaths?.length) return;
      selectedFilePath = res.filePaths[0];
      selectedFileName = selectedFilePath.split('/').pop() ?? selectedFilePath;
      result = null;
      error = '';
      savedToLibrary = false;
    } catch (e: any) {
      error = e?.message ?? 'Failed to open file';
    }
  }

  // ── Convert ────────────────────────────────────────────────────────────────
  async function handleConvert() {
    if (!selectedFilePath) { error = 'Select a file first'; return; }

    isConverting = true;
    error = '';
    result = null;
    progress = 0;
    progressMsg = 'Starting…';
    savedToLibrary = false;

    try {
      const outputDir = await af.files.getMediaDir();
      const res = await af.audioToMidi.convert({
        inputPath: selectedFilePath,
        outputDir,
        onsetThreshold,
        frameThreshold,
        minimumNoteLength,
        minimumFrequency: minFreq,
        maximumFrequency: maxFreq,
      });
      convertJobId = res?.jobId ?? null;
    } catch (e: any) {
      isConverting = false;
      error = e?.message ?? 'Conversion failed';
    }
  }

  // ── Save to MIDI library ───────────────────────────────────────────────────
  async function handleSave() {
    if (!result) return;
    try {
      await af.files.import([result.midiPath]);
      savedToLibrary = true;
    } catch (e: any) {
      error = e?.message ?? 'Failed to save';
    }
  }

  // ── Reveal in Finder ───────────────────────────────────────────────────────
  function handleReveal() {
    if (!result) return;
    af.files.revealInFinder(result.midiPath);
  }

  // ── Export as ─────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!result) return;
    try {
      const res = await af.files.showSaveDialog({
        defaultPath: result.midiPath.split('/').pop(),
        filters: [{ name: 'MIDI Files', extensions: ['mid'] }],
      });
      if (res.canceled || !res.filePath) return;
      // Read source and write to chosen path
      const buf: ArrayBuffer = await af.files.readAsArrayBuffer(result.midiPath);
      await af.files.writeFile(res.filePath, new Uint8Array(buf));
    } catch (e: any) {
      error = e?.message ?? 'Export failed';
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${m}:${sec.padStart(4, '0')}`;
  }

  function midiFileName(p: string) {
    return p.split('/').pop() ?? p;
  }
</script>

<div class="view">
  <!-- ── Left: file picker + settings ───────────────────────── -->
  <div class="left-panel">

    <!-- Install gate -->
    <div class="install-card" class:installed={isInstalled}>
      <div class="install-header">
        <span class="install-label">Basic Pitch</span>
        <span class="install-dot" class:ok={isInstalled}></span>
        <span class="install-status">{isInstalled ? 'Ready' : 'Not installed'}</span>
      </div>
      {#if !isInstalled}
        <button
          class="install-btn"
          onclick={handleInstall}
          disabled={isInstalling}
        >
          {isInstalling ? 'Installing…' : 'Install'}
        </button>
        {#if isInstalling}
          <div class="mini-progress">
            <div class="mini-fill" style="width:{progress}%"></div>
          </div>
        {/if}
        {#if installError}
          <div class="err-small">{installError}</div>
        {/if}
      {/if}
    </div>

    <!-- Source file -->
    <div class="section-label">Source File</div>
    <button class="browse-btn" onclick={handleBrowse} disabled={isConverting}>
      Browse…
    </button>

    {#if selectedFilePath}
      <div class="selected-pill" title={selectedFilePath}>
        🎵 {selectedFileName}
      </div>
    {/if}

    <div class="divider"></div>
    <div class="section-label">From Library</div>

    <div class="asset-list">
      {#each libraryAssets as asset (asset.id)}
        <button
          class="asset-row"
          class:active={asset.file_path === selectedFilePath}
          onclick={() => selectAsset(asset)}
          disabled={isConverting}
        >
          <span class="asset-name" title={asset.name}>{asset.name}</span>
          {#if asset.bpm}
            <span class="asset-bpm">{asset.bpm}</span>
          {/if}
        </button>
      {:else}
        <div class="empty-lib">Library is empty</div>
      {/each}
    </div>
  </div>

  <!-- ── Right: settings + output ───────────────────────────── -->
  <div class="right-panel">

    <!-- Settings -->
    <div class="settings-card">
      <div class="settings-title">Settings</div>

      <div class="setting-row">
        <label for="onset-threshold">Onset Sensitivity</label>
        <div class="slider-row">
          <input id="onset-threshold" type="range" min="0.1" max="0.9" step="0.05"
            bind:value={onsetThreshold} disabled={isConverting} />
          <span class="val">{onsetThreshold.toFixed(2)}</span>
        </div>
      </div>

      <div class="setting-row">
        <label for="frame-threshold">Frame Sensitivity</label>
        <div class="slider-row">
          <input id="frame-threshold" type="range" min="0.1" max="0.9" step="0.05"
            bind:value={frameThreshold} disabled={isConverting} />
          <span class="val">{frameThreshold.toFixed(2)}</span>
        </div>
      </div>

      <div class="setting-row">
        <label for="min-note-length">Min Note Length <span class="unit">ms</span></label>
        <div class="slider-row">
          <input id="min-note-length" type="range" min="10" max="200" step="5"
            bind:value={minimumNoteLength} disabled={isConverting} />
          <span class="val">{minimumNoteLength}</span>
        </div>
      </div>

      <div class="setting-row two-col">
        <div>
          <label for="min-freq">Min Freq <span class="unit">Hz</span></label>
          <input id="min-freq" class="num-input" type="number" min="20" max="500" step="1"
            bind:value={minFreq} disabled={isConverting} />
        </div>
        <div>
          <label for="max-freq">Max Freq <span class="unit">Hz</span></label>
          <input id="max-freq" class="num-input" type="number" min="200" max="8000" step="1"
            bind:value={maxFreq} disabled={isConverting} />
        </div>
      </div>
    </div>

    <!-- Convert button + progress -->
    <button
      class="convert-btn"
      onclick={handleConvert}
      disabled={!isInstalled || !selectedFilePath || isConverting}
    >
      {#if isConverting}
        <span class="spinner"></span> Converting…
      {:else}
        🎹 Convert to MIDI
      {/if}
    </button>

    {#if isConverting}
      <div class="progress-wrap">
        <div class="prog-bar">
          <div class="prog-fill" style="width:{progress}%"></div>
        </div>
        <span class="prog-text">{progress}% {progressMsg}</span>
      </div>
    {/if}

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    <!-- Result -->
    {#if result}
      <div class="result-card">
        <div class="result-title">✓ Conversion Complete</div>

        <div class="result-filename">{midiFileName(result.midiPath)}</div>

        <div class="result-stats">
          <div class="stat">
            <span class="stat-label">Notes</span>
            <span class="stat-value">{result.noteCount}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Duration</span>
            <span class="stat-value">{formatDuration(result.durationSec)}</span>
          </div>
          {#if result.estimatedTempo}
            <div class="stat">
              <span class="stat-label">BPM</span>
              <span class="stat-value">{Math.round(result.estimatedTempo)}</span>
            </div>
          {/if}
        </div>

        <div class="result-actions">
          <button
            class="action-btn primary"
            onclick={handleSave}
            disabled={savedToLibrary}
          >
            {savedToLibrary ? '✓ Saved to Library' : '+ Save to Library'}
          </button>
          <button class="action-btn" onclick={handleReveal}>
            Show in Finder
          </button>
          <button class="action-btn" onclick={handleExport}>
            Export as…
          </button>
        </div>
      </div>
    {:else if !isConverting && selectedFilePath && isInstalled}
      <div class="idle-state">
        <div class="idle-icon">🎹</div>
        <p>Press <strong>Convert to MIDI</strong> to analyse this file.</p>
        <p class="idle-note">
          Basic Pitch detects pitched notes — works best on melodic
          instruments. For drums, try lower onset sensitivity.
        </p>
      </div>
    {:else if !selectedFilePath}
      <div class="idle-state">
        <div class="idle-icon">🎵</div>
        <p>Select a file from your library or browse to get started.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .view {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: #0f0f1e;
  }

  /* ── Left panel ─────────────────────────────────────────── */
  .left-panel {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 10px;
    overflow: hidden;
  }

  .install-card {
    padding: 10px 12px;
    background: rgba(239,83,80,0.06);
    border: 1px solid rgba(239,83,80,0.2);
    border-radius: 7px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .install-card.installed {
    background: rgba(129,199,132,0.06);
    border-color: rgba(129,199,132,0.2);
  }

  .install-header {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
  }

  .install-label { font-weight: 600; color: rgba(255,255,255,0.8); }

  .install-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #ef5350;
    flex-shrink: 0;
  }
  .install-dot.ok { background: #81c784; }

  .install-status { color: rgba(255,255,255,0.45); font-size: 11px; }

  .install-btn {
    padding: 5px 10px;
    background: #64b5f6;
    border: none;
    border-radius: 5px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    align-self: flex-start;
  }
  .install-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .mini-progress {
    height: 3px;
    background: rgba(255,255,255,0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .mini-fill {
    height: 100%;
    background: #64b5f6;
    transition: width 0.3s;
  }

  .err-small { font-size: 11px; color: #ef5350; }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }

  .browse-btn {
    padding: 7px 12px;
    background: rgba(100,181,246,0.1);
    border: 1px solid rgba(100,181,246,0.25);
    border-radius: 6px;
    color: #64b5f6;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .browse-btn:hover:not(:disabled) { background: rgba(100,181,246,0.18); }
  .browse-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .selected-pill {
    padding: 7px 10px;
    background: rgba(100,181,246,0.08);
    border: 1px solid rgba(100,181,246,0.2);
    border-radius: 6px;
    font-size: 12px;
    color: rgba(255,255,255,0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'SF Mono','Fira Code',monospace;
  }

  .divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
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
    gap: 6px;
    padding: 7px 10px;
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s;
    width: 100%;
  }
  .asset-row:hover:not(:disabled) {
    background: rgba(255,255,255,0.04);
    border-color: rgba(255,255,255,0.08);
  }
  .asset-row.active {
    background: rgba(100,181,246,0.1);
    border-color: rgba(100,181,246,0.3);
  }
  .asset-row:disabled { opacity: 0.4; cursor: not-allowed; }

  .asset-name {
    font-size: 12px;
    color: rgba(255,255,255,0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .asset-bpm {
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    flex-shrink: 0;
    font-family: 'SF Mono','Fira Code',monospace;
  }
  .empty-lib {
    padding: 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    text-align: center;
  }

  /* ── Right panel ────────────────────────────────────────── */
  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    overflow-y: auto;
  }

  .settings-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .settings-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .setting-row label {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,0.65);
  }

  .unit { color: rgba(255,255,255,0.3); font-weight: 400; }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .slider-row input[type='range'] {
    flex: 1;
    cursor: pointer;
    accent-color: #64b5f6;
  }
  .slider-row input:disabled { opacity: 0.4; cursor: not-allowed; }

  .val {
    font-size: 12px;
    color: #64b5f6;
    font-weight: 600;
    min-width: 36px;
    text-align: right;
    font-family: 'SF Mono','Fira Code',monospace;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    flex-direction: unset;
  }

  .num-input {
    width: 100%;
    padding: 6px 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 5px;
    color: rgba(255,255,255,0.9);
    font-size: 12px;
    text-align: center;
  }
  .num-input:disabled { opacity: 0.4; }

  /* ── Convert button ───────────────────────────────────────── */
  .convert-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 0;
    background: #64b5f6;
    border: none;
    border-radius: 8px;
    color: #000;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }
  .convert-btn:hover:not(:disabled) { background: #7fc3f8; }
  .convert-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .prog-bar {
    height: 5px;
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    overflow: hidden;
  }
  .prog-fill {
    height: 100%;
    background: linear-gradient(90deg, #64b5f6, #42a5f5);
    transition: width 0.3s;
  }
  .prog-text {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    text-align: center;
  }

  .error-banner {
    padding: 10px 14px;
    background: rgba(239,83,80,0.1);
    border: 1px solid rgba(239,83,80,0.3);
    border-radius: 6px;
    color: #ef5350;
    font-size: 13px;
  }

  /* ── Result ───────────────────────────────────────────────── */
  .result-card {
    background: rgba(129,199,132,0.06);
    border: 1px solid rgba(129,199,132,0.25);
    border-radius: 8px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .result-title {
    font-size: 13px;
    font-weight: 700;
    color: #81c784;
  }

  .result-filename {
    font-size: 13px;
    color: rgba(255,255,255,0.8);
    font-family: 'SF Mono','Fira Code',monospace;
    word-break: break-all;
  }

  .result-stats {
    display: flex;
    gap: 20px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }
  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    font-variant-numeric: tabular-nums;
  }

  .result-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 8px 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    color: rgba(255,255,255,0.8);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .action-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }
  .action-btn.primary {
    background: rgba(129,199,132,0.15);
    border-color: rgba(129,199,132,0.35);
    color: #81c784;
  }
  .action-btn.primary:hover:not(:disabled) {
    background: rgba(129,199,132,0.22);
  }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Idle states ──────────────────────────────────────────── */
  .idle-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 10px;
    color: rgba(255,255,255,0.4);
    padding: 40px 24px;
  }
  .idle-icon { font-size: 36px; opacity: 0.5; }
  .idle-state p { margin: 0; font-size: 14px; line-height: 1.6; }
  .idle-state strong { color: rgba(255,255,255,0.6); }
  .idle-note {
    font-size: 12px !important;
    color: rgba(255,255,255,0.3) !important;
    max-width: 340px;
  }

  /* ── Spinner ──────────────────────────────────────────────── */
  .spinner {
    width: 13px; height: 13px;
    border: 2px solid rgba(0,0,0,0.3);
    border-top-color: #000;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>

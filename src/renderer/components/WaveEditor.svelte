<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WaveSurfer from 'wavesurfer.js';
  import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
  import { activePlayer } from '../stores/playbackStore';

  // Accept an initial file from the parent (e.g. clicking a file in the Library)
  export let filePath: string = '';
  export let fileName: string = '';

  let isPlaying: boolean = false;
  let currentTime: number = 0;
  let duration: number = 0;
  let isProcessing: boolean = false;
  let processingLabel: string = '';
  let metadata: { bpm?: number; key?: string; sampleRate?: number; channels?: number } = {};
  let editHistory: string[] = [];
  let redoHistory: string[] = [];

  let wavesurfer: WaveSurfer | null = null;
  let waveformContainer: HTMLElement | null = null;
  let regionsPlugin: any = null;

  // Parameter inputs state
  let showFadeInParam: boolean = false;
  let fadeInDuration: number = 2;
  let showFadeOutParam: boolean = false;
  let fadeOutDuration: number = 2;
  let showPitchParam: boolean = false;
  let pitchSemitones: number = 0;
  let showTimeStretchParam: boolean = false;
  let timeStretchFactor: number = 1.0;

  onMount(async () => {
    // Initialize WaveSurfer
    if (waveformContainer) {
      wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        waveColor: '#6366f1',
        progressColor: '#4f46e5',
        cursorColor: '#ffffff',
        height: 200,
        normalize: true,
      });

      // Register regions plugin
      regionsPlugin = wavesurfer.registerPlugin(RegionsPlugin.create());

      // Listen to playback events
      wavesurfer.on('play', () => {
        isPlaying = true;
      });

      wavesurfer.on('pause', () => {
        isPlaying = false;
      });

      wavesurfer.on('timeupdate', (time: number) => {
        currentTime = time;
      });

      wavesurfer.on('ready', () => {
        duration = wavesurfer?.getDuration() || 0;
      });
    }

    // If a file was passed in as a prop (e.g. opened from the Library), load it
    if (filePath) {
      await loadFileFromPath(filePath, fileName || filePath.split('/').pop() || 'audio');
    }

    return () => {
      if (wavesurfer) {
        wavesurfer.destroy();
      }
    };
  });

  // Exclusive playback: stop WaveEditor when another player starts
  const unsubPlayer = activePlayer.subscribe((id) => {
    if (id !== null && id !== 'wave-editor' && isPlaying && wavesurfer) {
      wavesurfer.stop();
    }
  });

  onDestroy(() => {
    unsubPlayer();
    if (wavesurfer) {
      wavesurfer.destroy();
    }
  });

  /**
   * Read a local file via IPC (main process) and return a blob: URL
   * that WaveSurfer can safely fetch() from the renderer.
   */
  async function toBlobUrl(path: string): Promise<string> {
    const af = (window as any).audioforge;
    const buffer = await af.files.readAsArrayBuffer(path);
    const ext = path.split('.').pop()?.toLowerCase() || 'wav';
    const mimeMap: Record<string, string> = {
      wav: 'audio/wav', mp3: 'audio/mpeg', flac: 'audio/flac',
      aiff: 'audio/aiff', aif: 'audio/aiff', ogg: 'audio/ogg',
      m4a: 'audio/mp4', aac: 'audio/aac',
    };
    const blob = new Blob([buffer], { type: mimeMap[ext] || 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  /** Core file-loading routine shared by the dialog picker and the Library-click path. */
  async function loadFileFromPath(path: string, name: string) {
    const af = (window as any).audioforge;
    filePath = path;
    fileName = name;
    editHistory = [];
    redoHistory = [];

    try {
      // Load metadata
      const [durationVal, metadataVal] = await Promise.all([
        af.audio.getDuration(path),
        af.audio.getMetadata(path),
      ]);

      duration = durationVal;
      metadata = metadataVal || {};

      // Load audio into WaveSurfer via blob: URL (IPC reads the file in main process)
      if (wavesurfer) {
        const blobUrl = await toBlobUrl(path);
        await wavesurfer.load(blobUrl);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  }

  async function handleOpenFile() {
    try {
      const af = (window as any).audioforge;
      const result = await af.files.showOpenDialog({
        filters: [
          {
            name: 'Audio Files',
            extensions: ['wav', 'mp3', 'flac', 'aiff', 'ogg'],
          },
        ],
      });

      if (!result?.filePaths?.[0]) return;

      const newFilePath = result.filePaths[0];
      await loadFileFromPath(newFilePath, newFilePath.split('/').pop() || 'audio');
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }

  async function applyEdit(
    editName: string,
    operationFn: (filePath: string, outputPath: string, ...args: any[]) => Promise<string>,
    ...args: any[]
  ) {
    if (!filePath) return;

    isProcessing = true;
    processingLabel = `Applying ${editName}...`;
    redoHistory = [];

    try {
      const af = (window as any).audioforge;
      const timestamp = Date.now();
      const ext = filePath.split('.').pop() || 'wav';
      const mediaDir = await af.files.getMediaDir?.();
      const outputPath = `${mediaDir}/${editName.replace(/\s+/g, '_')}_${timestamp}.${ext}`;

      editHistory.push(filePath);
      const newFilePath = await operationFn(filePath, outputPath, ...args);
      filePath = newFilePath;
      fileName = filePath.split('/').pop() || 'audio';

      // Reload waveform via blob URL
      if (wavesurfer) {
        const blobUrl = await toBlobUrl(filePath);
        await wavesurfer.load(blobUrl);
      }

      // Update metadata
      const [durationVal, metadataVal] = await Promise.all([
        af.audio.getDuration(filePath),
        af.audio.getMetadata(filePath),
      ]);

      duration = durationVal;
      metadata = metadataVal || {};
    } catch (error) {
      console.error(`Failed to apply ${editName}:`, error);
      editHistory.pop(); // Undo the push if operation failed
    } finally {
      isProcessing = false;
      processingLabel = '';
    }
  }

  async function handleNormalize() {
    const af = (window as any).audioforge;
    await applyEdit('Normalize', af.audio.normalize);
  }

  async function handleReverse() {
    const af = (window as any).audioforge;
    await applyEdit('Reverse', af.audio.reverse);
  }

  async function handleSilenceRemove() {
    const af = (window as any).audioforge;
    await applyEdit('Silence Removal', af.audio.silenceRemove);
  }

  async function handleFadeIn() {
    showFadeInParam = false;
    const af = (window as any).audioforge;
    await applyEdit('Fade In', af.audio.fadeIn, fadeInDuration);
    fadeInDuration = 2;
  }

  async function handleFadeOut() {
    showFadeOutParam = false;
    const af = (window as any).audioforge;
    await applyEdit('Fade Out', af.audio.fadeOut, fadeOutDuration);
    fadeOutDuration = 2;
  }

  async function handlePitchShift() {
    showPitchParam = false;
    const af = (window as any).audioforge;
    await applyEdit('Pitch Shift', af.audio.pitchShift, pitchSemitones);
    pitchSemitones = 0;
  }

  async function handleTimeStretch() {
    showTimeStretchParam = false;
    const af = (window as any).audioforge;
    await applyEdit('Time Stretch', af.audio.timeStretch, timeStretchFactor);
    timeStretchFactor = 1.0;
  }

  async function handleTrim() {
    if (!regionsPlugin) return;

    const regions = regionsPlugin.getRegions?.() || [];
    if (regions.length === 0) {
      console.warn('No region selected for trim');
      return;
    }

    const region = regions[0];
    const af = (window as any).audioforge;
    await applyEdit('Trim', af.audio.trim, region.start, region.end);
  }

  function handleUndo() {
    if (editHistory.length === 0) return;

    const previousPath = editHistory.pop();
    if (previousPath && filePath) {
      redoHistory.push(filePath);
    }

    if (previousPath) {
      filePath = previousPath;
      fileName = filePath.split('/').pop() || 'audio';

      // Reload waveform
      reloadWaveform();
    }
  }

  function handleRedo() {
    if (redoHistory.length === 0) return;

    const nextPath = redoHistory.pop();
    if (nextPath) {
      editHistory.push(filePath);
      filePath = nextPath;
      fileName = filePath.split('/').pop() || 'audio';

      // Reload waveform
      reloadWaveform();
    }
  }

  async function reloadWaveform() {
    if (!filePath || !wavesurfer) return;

    try {
      const af = (window as any).audioforge;
      const blobUrl = await toBlobUrl(filePath);

      await wavesurfer.load(blobUrl);

      // Update metadata
      const [durationVal, metadataVal] = await Promise.all([
        af.audio.getDuration(filePath),
        af.audio.getMetadata(filePath),
      ]);

      duration = durationVal;
      metadata = metadataVal || {};
    } catch (error) {
      console.error('Failed to reload waveform:', error);
    }
  }

  function formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '00:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  }

  function handlePlay() {
    if (wavesurfer) {
      activePlayer.set('wave-editor');
      wavesurfer.play();
    }
  }

  function handleStop() {
    if (wavesurfer) {
      wavesurfer.stop();
      activePlayer.set(null);
    }
  }

  function handleFadeInClick() {
    showFadeInParam = !showFadeInParam;
    if (!showFadeInParam) {
      fadeInDuration = 2;
    }
  }

  function handleFadeOutClick() {
    showFadeOutParam = !showFadeOutParam;
    if (!showFadeOutParam) {
      fadeOutDuration = 2;
    }
  }

  function handlePitchClick() {
    showPitchParam = !showPitchParam;
    if (!showPitchParam) {
      pitchSemitones = 0;
    }
  }

  function handleTimeStretchClick() {
    showTimeStretchParam = !showTimeStretchParam;
    if (!showTimeStretchParam) {
      timeStretchFactor = 1.0;
    }
  }
</script>

<div class="wave-editor">
  <!-- Top Bar -->
  <div class="top-bar">
    <div class="top-bar-left">
      <button
        class="btn btn-primary"
        onclick={handleOpenFile}
        title="Open audio file"
      >
        Open File
      </button>
      <span class="filename">{fileName || 'No file loaded'}</span>
    </div>

    <div class="top-bar-right">
      <button
        class="btn btn-secondary"
        onclick={handleUndo}
        disabled={editHistory.length === 0 || isProcessing}
        title="Undo last operation"
      >
        ↩ Undo
      </button>
      <button
        class="btn btn-secondary"
        onclick={handleRedo}
        disabled={redoHistory.length === 0 || isProcessing}
        title="Redo operation"
      >
        ↪ Redo
      </button>
    </div>
  </div>

  <!-- Waveform Area -->
  <div class="waveform-area">
    <div class="waveform-container" bind:this={waveformContainer}></div>
  </div>

  <!-- Time Display & Transport -->
  <div class="transport-section">
    <div class="time-display">
      <span>{formatTime(currentTime)}</span>
      <span>/</span>
      <span>{formatTime(duration)}</span>
    </div>

    <div class="transport-controls">
      <button
        class="btn btn-primary"
        onclick={handlePlay}
        disabled={!filePath}
        title="Play"
      >
        ▶ Play
      </button>
      <button
        class="btn btn-secondary"
        onclick={handleStop}
        disabled={!filePath}
        title="Stop"
      >
        ⏹ Stop
      </button>
    </div>
  </div>

  <!-- Edit Toolbar -->
  <div class="edit-toolbar">
    <button
      class="btn btn-secondary"
      onclick={handleTrim}
      disabled={!filePath || isProcessing}
      title="Trim to selected region"
    >
      Trim
    </button>

    <button
      class="btn btn-secondary"
      onclick={handleNormalize}
      disabled={!filePath || isProcessing}
      title="Normalize audio"
    >
      Normalize
    </button>

    <div class="param-group">
      <button
        class="btn btn-secondary"
        onclick={handleFadeInClick}
        disabled={!filePath || isProcessing}
        title="Apply fade in"
      >
        Fade In
      </button>
      {#if showFadeInParam && filePath}
        <div class="fade-in-param param-input">
          <label for="fade-in-duration">Duration (s):</label>
          <input
            id="fade-in-duration"
            type="number"
            bind:value={fadeInDuration}
            min="0.1"
            max="10"
            step="0.1"
          />
          <button class="btn btn-primary btn-small" onclick={handleFadeIn}>
            Apply
          </button>
        </div>
      {/if}
    </div>

    <div class="param-group">
      <button
        class="btn btn-secondary"
        onclick={handleFadeOutClick}
        disabled={!filePath || isProcessing}
        title="Apply fade out"
      >
        Fade Out
      </button>
      {#if showFadeOutParam && filePath}
        <div class="fade-out-param param-input">
          <label for="fade-out-duration">Duration (s):</label>
          <input
            id="fade-out-duration"
            type="number"
            bind:value={fadeOutDuration}
            min="0.1"
            max="10"
            step="0.1"
          />
          <button class="btn btn-primary btn-small" onclick={handleFadeOut}>
            Apply
          </button>
        </div>
      {/if}
    </div>

    <button
      class="btn btn-secondary"
      onclick={handleReverse}
      disabled={!filePath || isProcessing}
      title="Reverse audio"
    >
      Reverse
    </button>

    <div class="param-group">
      <button
        class="btn btn-secondary"
        onclick={handlePitchClick}
        disabled={!filePath || isProcessing}
        title="Shift pitch"
      >
        Pitch
      </button>
      {#if showPitchParam && filePath}
        <div class="pitch-param param-input">
          <label for="pitch-semitones">Semitones:</label>
          <input
            id="pitch-semitones"
            type="range"
            bind:value={pitchSemitones}
            min="-12"
            max="12"
            step="1"
          />
          <span>{pitchSemitones}</span>
          <button class="btn btn-primary btn-small" onclick={handlePitchShift}>
            Apply
          </button>
        </div>
      {/if}
    </div>

    <div class="param-group">
      <button
        class="btn btn-secondary"
        onclick={handleTimeStretchClick}
        disabled={!filePath || isProcessing}
        title="Change playback speed"
      >
        Time Stretch
      </button>
      {#if showTimeStretchParam && filePath}
        <div class="time-stretch-param param-input">
          <label for="time-stretch-factor">Factor:</label>
          <input
            id="time-stretch-factor"
            type="range"
            bind:value={timeStretchFactor}
            min="0.5"
            max="2.0"
            step="0.1"
          />
          <span>{timeStretchFactor.toFixed(1)}x</span>
          <button class="btn btn-primary btn-small" onclick={handleTimeStretch}>
            Apply
          </button>
        </div>
      {/if}
    </div>

    <button
      class="btn btn-secondary"
      onclick={handleSilenceRemove}
      disabled={!filePath || isProcessing}
      title="Remove silence"
    >
      Silence Rm
    </button>
  </div>

  <!-- Processing Label -->
  {#if isProcessing}
    <div class="processing-label">
      {processingLabel}
    </div>
  {/if}

  <!-- Metadata Bar -->
  <div class="metadata-bar">
    {#if metadata.bpm}
      <span>BPM: {metadata.bpm}</span>
    {/if}
    {#if metadata.key}
      <span>Key: {metadata.key}</span>
    {/if}
    {#if duration > 0}
      <span>Duration: {duration.toFixed(1)}s</span>
    {/if}
    {#if metadata.sampleRate}
      <span>{metadata.sampleRate}Hz</span>
    {/if}
  </div>
</div>

<style>
  .wave-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    overflow: hidden;
    gap: 0;
  }

  /* Top Bar */
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
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .filename {
    font-size: 13px;
    color: #e0e0f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .top-bar-right {
    display: flex;
    gap: 8px;
  }

  /* Waveform Area */
  .waveform-area {
    flex: 1;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .waveform-container {
    width: 100%;
    height: 100%;
    min-height: 200px;
  }

  /* Transport Section */
  .transport-section {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .time-display {
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    color: #a0a0b8;
    min-width: 80px;
  }

  .transport-controls {
    display: flex;
    gap: 8px;
  }

  /* Edit Toolbar */
  .edit-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    align-items: flex-start;
  }

  .param-group {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0;
  }

  .param-input {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    display: flex;
    gap: 6px;
    align-items: center;
    background: rgba(30, 30, 46, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 8px 12px;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
  }

  .param-input label {
    font-size: 11px;
    color: #a0a0b8;
    font-weight: 600;
  }

  .param-input input[type='number'],
  .param-input input[type='range'] {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: #e0e0f0;
    font-size: 11px;
    width: 60px;
  }

  .param-input input[type='range'] {
    width: 80px;
    padding: 0;
    height: 4px;
  }

  .param-input span {
    font-size: 11px;
    color: #a0a0b8;
    min-width: 30px;
  }

  /* Processing Label */
  .processing-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 8px;
    padding: 12px 24px;
    color: #a5b4fc;
    font-size: 13px;
    font-weight: 600;
    z-index: 20;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }

  /* Metadata Bar */
  .metadata-bar {
    display: flex;
    gap: 20px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: #a0a0b8;
  }

  .metadata-bar span {
    display: flex;
    align-items: center;
  }

  /* Buttons */
  .btn {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #e0e0f0;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-primary {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.4);
    color: #a5b4fc;
  }

  .btn-primary:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.35);
    border-color: rgba(99, 102, 241, 0.6);
  }

  .btn-small {
    padding: 4px 8px;
    font-size: 10px;
  }
</style>

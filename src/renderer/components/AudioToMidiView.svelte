<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Button from './ui/Button.svelte';

  interface ConversionResult {
    midiPath: string;
    noteCount: number;
    durationSec: number;
    estimatedTempo?: number;
  }

  // File selection
  let selectedFilePath: string = '';
  let selectedFileName: string = '';

  // Settings
  let onsetThreshold: number = 0.5;
  let minNoteDuration: number = 0.1;
  let quantizeToGrid: boolean = true;
  let quantizeResolution: '1/4' | '1/8' | '1/16' | '1/32' = '1/16';

  // Conversion state
  let isConverting: boolean = false;
  let progress: number = 0;
  let error: string = '';
  let result: ConversionResult | null = null;

  // IPC progress listener
  let unsubscribeProgress: (() => void) | null = null;

  async function selectFile() {
    try {
      const af = (window as any).audioforge;
      const response = await af.files.showOpenDialog({
        filters: [
          {
            name: 'Audio Files',
            extensions: ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a'],
          },
        ],
      });

      if (response.filePaths && response.filePaths.length > 0) {
        selectedFilePath = response.filePaths[0];
        // Extract filename from path
        const parts = selectedFilePath.split(/[/\\]/);
        selectedFileName = parts[parts.length - 1];
        error = '';
      }
    } catch (e) {
      error = `Failed to select file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  async function convertToMidi() {
    if (!selectedFilePath) {
      error = 'No file selected';
      return;
    }

    isConverting = true;
    error = '';
    progress = 0;

    try {
      const af = (window as any).audioforge;

      // Get output directory (media dir)
      const mediaDir = await af.files.getMediaDir();

      // Set up progress listener
      if (unsubscribeProgress) {
        unsubscribeProgress();
      }
      unsubscribeProgress = af.on('job:progress', (jobId: string, data: any) => {
        if (data.progress !== undefined) {
          progress = Math.min(100, data.progress);
        }
      });

      // Call convert
      const response = await af.audioToMidi.convert({
        inputPath: selectedFilePath,
        outputDir: mediaDir,
        onsetThreshold,
        minimumNoteLength: minNoteDuration * 1000, // Convert to ms
        inferOnsets: true,
      });

      // Poll job status until complete
      const jobId = response.jobId;
      let jobComplete = false;
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes with 1s interval

      while (!jobComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const status = await af.jobs.getStatus(jobId);
        if (status.status === 'completed' && status.result) {
          result = status.result;
          jobComplete = true;
          progress = 100;
        } else if (status.status === 'failed') {
          error = `Conversion failed: ${status.error || 'Unknown error'}`;
          jobComplete = true;
        }
        attempts++;
      }

      if (!jobComplete) {
        error = 'Conversion timed out';
      }
    } catch (e) {
      error = `Conversion failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
    } finally {
      isConverting = false;
    }
  }

  async function saveMidiToLibrary() {
    if (!result) return;

    try {
      const af = (window as any).audioforge;
      await af.audioToMidi.importMidi(result.midiPath);
      // Success message could be shown via toast notification
    } catch (e) {
      error = `Failed to import MIDI: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  async function openInFinder() {
    if (!result) return;

    try {
      const af = (window as any).audioforge;
      await af.koala.openInFinder(result.midiPath);
    } catch (e) {
      error = `Failed to open folder: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  async function exportAs() {
    if (!result) return;

    try {
      const af = (window as any).audioforge;
      const response = await af.files.showSaveDialog({
        defaultPath: result.midiPath,
        filters: [{ name: 'MIDI Files', extensions: ['mid'] }],
      });

      if (response.filePath) {
        // In a real implementation, we'd copy the file here
        // For now, just show the path
        console.log('Export to:', response.filePath);
      }
    } catch (e) {
      error = `Failed to export: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs}`;
  }

  onDestroy(() => {
    if (unsubscribeProgress) {
      unsubscribeProgress();
    }
  });
</script>

<div class="audio-to-midi-view">
  <div class="panels">
    <!-- Left Panel: File Picker & Settings -->
    <div class="left-panel">
      <div class="section">
        <h3>Select Audio File</h3>
        <Button on:click={selectFile} variant="primary">
          {selectedFileName || 'Choose File'}
        </Button>
        {#if selectedFileName}
          <p class="selected-file">{selectedFileName}</p>
        {/if}
      </div>

      <div class="settings-section">
        <h3>Settings</h3>

        <div class="control-group">
          <label for="onset-threshold">Onset Sensitivity</label>
          <input
            id="onset-threshold"
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            bind:value={onsetThreshold}
            disabled={isConverting}
          />
          <span class="value">{onsetThreshold.toFixed(1)}</span>
        </div>

        <div class="control-group">
          <label for="min-note-duration">Min Note Duration (s)</label>
          <input
            id="min-note-duration"
            type="range"
            min="0.05"
            max="0.5"
            step="0.05"
            bind:value={minNoteDuration}
            disabled={isConverting}
          />
          <span class="value">{minNoteDuration.toFixed(2)}</span>
        </div>

        <div class="checkbox-group">
          <input
            id="quantize-checkbox"
            type="checkbox"
            bind:checked={quantizeToGrid}
            disabled={isConverting}
          />
          <label for="quantize-checkbox">Quantize to grid</label>
        </div>

        {#if quantizeToGrid}
          <div class="control-group">
            <label for="quantize-resolution">Quantize Resolution</label>
            <select
              id="quantize-resolution"
              bind:value={quantizeResolution}
              disabled={isConverting}
            >
              <option value="1/4">1/4</option>
              <option value="1/8">1/8</option>
              <option value="1/16">1/16</option>
              <option value="1/32">1/32</option>
            </select>
          </div>
        {/if}
      </div>

      <div class="action-section">
        <Button
          on:click={convertToMidi}
          disabled={!selectedFileName || isConverting}
          variant="primary"
        >
          {isConverting ? 'Converting...' : 'Convert to MIDI'}
        </Button>

        {#if isConverting}
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style={`width: ${progress}%`}></div>
            </div>
            <span class="progress-text">{progress}%</span>
          </div>
        {/if}
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}
    </div>

    <!-- Right Panel: Result Preview -->
    <div class="right-panel">
      {#if !result}
        <div class="empty-state">
          <p>Select an audio file to convert to MIDI</p>
        </div>
      {:else}
        <div class="result-card">
          <h3>Conversion Result</h3>

          <div class="result-info">
            <div class="info-row">
              <span class="label">File:</span>
              <span class="value">{result.midiPath.split(/[/\\]/).pop()}</span>
            </div>

            <div class="info-row">
              <span class="label">Notes Detected:</span>
              <span class="value">{result.noteCount}</span>
            </div>

            <div class="info-row">
              <span class="label">Duration:</span>
              <span class="value">{formatDuration(result.durationSec)}</span>
            </div>

            {#if result.estimatedTempo}
              <div class="info-row">
                <span class="label">Detected BPM:</span>
                <span class="value">{Math.round(result.estimatedTempo)} BPM</span>
              </div>
            {/if}
          </div>

          <div class="action-buttons">
            <Button on:click={saveMidiToLibrary} variant="primary">
              Save to MIDI Library
            </Button>
            <Button on:click={openInFinder} variant="secondary">
              Open in Finder
            </Button>
            <Button on:click={exportAs} variant="secondary">
              Export as...
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .audio-to-midi-view {
    width: 100%;
    height: 100%;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    overflow-y: auto;
  }

  .panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .left-panel,
  .right-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section,
  .settings-section,
  .action-section,
  .result-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 16px;
  }

  h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .selected-file {
    margin: 8px 0 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-family: 'Monaco', monospace;
    word-break: break-all;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }

  .control-group label {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .control-group input[type='range'],
  .control-group select {
    padding: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
  }

  .control-group input[type='range'] {
    cursor: pointer;
  }

  .control-group select {
    cursor: pointer;
  }

  .control-group select:hover {
    border-color: rgba(100, 181, 246, 0.5);
  }

  .control-group input[type='range']:disabled,
  .control-group select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .value {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 500;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .checkbox-group input[type='checkbox'] {
    cursor: pointer;
  }

  .checkbox-group label {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
  }

  .progress-container {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #64b5f6, #42a5f5);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    min-width: 30px;
    text-align: right;
  }

  .error-message {
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #ef4444;
    font-size: 12px;
    margin-top: 8px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .result-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .info-row .label {
    color: rgba(255, 255, 255, 0.6);
    font-weight: 500;
  }

  .info-row .value {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-buttons :global(button) {
    width: 100%;
  }
</style>

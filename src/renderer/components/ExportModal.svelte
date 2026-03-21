<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { exportService } from '../services/exportService';
  import { audioEngine } from '../services/audioEngine';

  export let projectName: string;
  export let tracks: Array<{ id: string; name: string; volume: number; muted: boolean }>;
  export let duration: number;

  const dispatch = createEventDispatcher<{ close: void; exported: { filePath: string } }>();

  let exporting = false;
  let statusMessage = '';
  let statusType: 'success' | 'error' | '' = '';

  async function handleExport() {
    exporting = true;
    statusMessage = '';
    statusType = '';

    const result = await exportService.exportProject({
      projectName,
      tracks,
      audioEngine,
      duration,
    });

    exporting = false;

    if (result.canceled) {
      return;
    }

    if (result.success && result.filePath) {
      statusMessage = `Export success: ${result.filePath}`;
      statusType = 'success';
      dispatch('exported', { filePath: result.filePath });
    } else {
      statusMessage = result.error ?? 'Export failed';
      statusType = 'error';
    }
  }

  function handleCancel() {
    dispatch('close');
  }
</script>

<div class="export-modal">
  <div class="export-header">
    <h2>Export Mix</h2>
    <p class="project-label">{projectName}</p>
  </div>

  <div class="track-list">
    <h3>Tracks</h3>
    {#each tracks as track}
      <div class="track-row" class:muted={track.muted}>
        <span class="track-name">{track.name}</span>
        {#if track.muted}
          <span class="muted-label muted">muted</span>
        {/if}
      </div>
    {/each}
  </div>

  {#if statusMessage}
    <div class="export-status {statusType}">
      {statusMessage}
    </div>
  {/if}

  <div class="export-actions">
    <button class="cancel-btn" on:click={handleCancel}>Cancel</button>
    <button class="export-btn" on:click={handleExport} disabled={exporting}>
      {exporting ? 'Exporting…' : 'Export'}
    </button>
  </div>
</div>

<style>
  .export-modal {
    background: #1e1e2e;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 24px;
    min-width: 360px;
    max-width: 480px;
    color: #cdd6f4;
  }

  .export-header h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
    color: #cba6f7;
  }

  .project-label {
    margin: 0 0 16px;
    font-size: 0.9rem;
    color: #a6adc8;
  }

  .track-list h3 {
    margin: 0 0 8px;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a6adc8;
  }

  .track-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .track-row.muted {
    opacity: 0.5;
  }

  .muted-label {
    font-size: 0.75rem;
    background: #45475a;
    padding: 1px 6px;
    border-radius: 3px;
    color: #f38ba8;
  }

  .export-status {
    margin: 16px 0 0;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 0.85rem;
    word-break: break-all;
  }

  .export-status.success {
    background: #1e3a2e;
    color: #a6e3a1;
    border: 1px solid #40a02b;
  }

  .export-status.error {
    background: #3a1e1e;
    color: #f38ba8;
    border: 1px solid #e64553;
  }

  .export-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  .cancel-btn,
  .export-btn {
    padding: 8px 18px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .cancel-btn {
    background: #313244;
    color: #cdd6f4;
  }

  .export-btn {
    background: #cba6f7;
    color: #1e1e2e;
    font-weight: 600;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>

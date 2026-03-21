<script lang="ts">
  import { onMount } from 'svelte';

  interface SyncSession {
    id: string;
    backend: string;
    status: 'synced' | 'failed' | 'out-of-sync' | 'syncing' | 'initialized';
    lastSyncTime: string;
  }

  let { projectId }: { projectId: string } = $props();

  let sessions: SyncSession[] = $state([]);
  let isLoading: boolean = $state(true);
  let selectedBackend: string = $state('git');

  const backends = ['git', 'dropbox', 's3'];

  // Audio → Video Sync state
  let refFilePath: string = $state('');
  let targetAudioPath: string = $state('');
  let outputPath: string = $state('');
  let offsetResult: { offsetSec: number; confidence: number } | null = $state(null);
  let isFindingOffset: boolean = $state(false);
  let isSyncing: boolean = $state(false);
  let syncError: string = $state('');
  let syncSuccess: string = $state('');

  onMount(async () => {
    isLoading = true;
    try {
      if ((window as any).audioforge?.sync?.listSessions) {
        sessions = await (window as any).audioforge.sync.listSessions(projectId);
      } else {
        sessions = [];
      }
    } catch (error) {
      console.error('Failed to list sessions:', error);
      sessions = [];
    } finally {
      isLoading = false;
    }
  });

  async function handleInitializeSync() {
    try {
      if ((window as any).audioforge?.sync?.initializeSync) {
        await (window as any).audioforge.sync.initializeSync(projectId, selectedBackend);
        // Refresh sessions list
        if ((window as any).audioforge?.sync?.listSessions) {
          sessions = await (window as any).audioforge.sync.listSessions(projectId);
        }
      }
    } catch (error) {
      console.error('Failed to initialize sync:', error);
    }
  }

  function formatDate(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  }

  function getStatusClass(status: string): string {
    return `status-${status.replace(/\s+/g, '-')}`;
  }

  async function handleBrowseRefFile() {
    try {
      const result = await (window as any).audioforge.files.showOpenDialog({ properties: ['openFile'] });
      if (result && result.filePaths && result.filePaths.length > 0) {
        refFilePath = result.filePaths[0];
      }
    } catch (error) {
      console.error('Failed to browse reference file:', error);
    }
  }

  async function handleBrowseTargetAudio() {
    try {
      const result = await (window as any).audioforge.files.showOpenDialog({ properties: ['openFile'] });
      if (result && result.filePaths && result.filePaths.length > 0) {
        targetAudioPath = result.filePaths[0];
      }
    } catch (error) {
      console.error('Failed to browse target audio:', error);
    }
  }

  async function handleBrowseOutputPath() {
    try {
      const result = await (window as any).audioforge.files.showOpenDialog({ properties: ['openFile'] });
      if (result && result.filePaths && result.filePaths.length > 0) {
        outputPath = result.filePaths[0];
      }
    } catch (error) {
      console.error('Failed to browse output path:', error);
    }
  }

  async function handleFindOffset() {
    if (!refFilePath || !targetAudioPath) return;

    isFindingOffset = true;
    syncError = '';
    syncSuccess = '';
    try {
      offsetResult = await (window as any).audioforge.mediaSync.findOffset(refFilePath, targetAudioPath);
    } catch (error) {
      console.error('Failed to find offset:', error);
      syncError = `Error finding offset: ${error instanceof Error ? error.message : 'Unknown error'}`;
      offsetResult = null;
    } finally {
      isFindingOffset = false;
    }
  }

  async function handleSyncAudio() {
    if (!refFilePath || !targetAudioPath || !outputPath || !offsetResult) return;

    isSyncing = true;
    syncError = '';
    syncSuccess = '';
    try {
      const result = await (window as any).audioforge.mediaSync.syncAudioWithVideo(
        refFilePath,
        targetAudioPath,
        offsetResult.offsetSec,
        outputPath
      );
      syncSuccess = `Sync complete! Output saved to: ${result.outputPath || outputPath}`;
    } catch (error) {
      console.error('Failed to sync audio:', error);
      syncError = `Error syncing audio: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isSyncing = false;
    }
  }
</script>

<div class="sync-view">
  <h2>Sync</h2>

  {#if isLoading}
    <div class="loading">Loading sync sessions...</div>
  {:else if sessions.length === 0}
    <div class="empty-state">
      <p>No sync sessions configured</p>
    </div>
  {:else}
    <div class="sessions-list">
      {#each sessions as session (session.id)}
        <div class="session-item">
          <div class="session-header">
            <span class="backend">{session.backend}</span>
            <span class={`badge ${getStatusClass(session.status)}`}>{session.status}</span>
          </div>
          <div class="session-meta">
            <span class="last-sync">Last sync: {formatDate(session.lastSyncTime)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="initialize-section">
    <div class="backend-selector">
      <label for="backend-select">Backend:</label>
      <select id="backend-select" bind:value={selectedBackend}>
        {#each backends as backend}
          <option value={backend}>{backend}</option>
        {/each}
      </select>
    </div>
    <button onclick={handleInitializeSync}>Initialize Sync</button>
  </div>

  <div class="audio-video-sync-section">
    <h3>Audio → Video Sync</h3>

    <div class="sync-form">
      <div class="form-group">
        <label for="ref-file">Reference File:</label>
        <div class="input-group">
          <input id="ref-file" type="text" value={refFilePath} readonly placeholder="Select reference file..." />
          <button onclick={handleBrowseRefFile}>Browse…</button>
        </div>
      </div>

      <div class="form-group">
        <label for="target-audio">Target Audio:</label>
        <div class="input-group">
          <input id="target-audio" type="text" value={targetAudioPath} readonly placeholder="Select target audio..." />
          <button onclick={handleBrowseTargetAudio}>Browse…</button>
        </div>
      </div>

      <button
        onclick={handleFindOffset}
        disabled={!refFilePath || !targetAudioPath || isFindingOffset}
        class="action-btn"
      >
        {#if isFindingOffset}
          Finding Offset...
        {:else}
          Find Offset
        {/if}
      </button>

      {#if offsetResult}
        <div class="offset-result">
          <p>Offset: {offsetResult.offsetSec}s | Confidence: {(offsetResult.confidence * 100).toFixed(0)}%</p>
        </div>
      {/if}

      {#if syncError}
        <div class="error-message">{syncError}</div>
      {/if}

      <div class="form-group">
        <label for="output-path">Output Path:</label>
        <div class="input-group">
          <input id="output-path" type="text" value={outputPath} readonly placeholder="Select output path..." />
          <button onclick={handleBrowseOutputPath}>Browse…</button>
        </div>
      </div>

      <button
        onclick={handleSyncAudio}
        disabled={!refFilePath || !targetAudioPath || !outputPath || !offsetResult || isSyncing}
        class="action-btn primary"
      >
        {#if isSyncing}
          Syncing...
        {:else}
          Sync Audio to Video
        {/if}
      </button>

      {#if syncSuccess}
        <div class="success-message">{syncSuccess}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .sync-view {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  h2 {
    margin: 0 0 20px 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .loading {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    padding: 12px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  .empty-state p {
    margin: 0;
  }

  .sessions-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .session-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .backend {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
  }

  .badge {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 3px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .status-synced {
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
  }

  .status-failed {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
  }

  .status-out-of-sync {
    background: rgba(255, 193, 7, 0.2);
    color: #ffc107;
  }

  .status-syncing {
    background: rgba(33, 150, 243, 0.2);
    color: #2196f3;
  }

  .status-initialized {
    background: rgba(156, 39, 176, 0.2);
    color: #9c27b0;
  }

  .session-meta {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .initialize-section {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .backend-selector {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  select {
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    cursor: pointer;
  }

  select:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  select:focus {
    outline: none;
    border-color: #64b5f6;
  }

  button {
    padding: 8px 16px;
    background: #64b5f6;
    border: none;
    border-radius: 4px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button:hover {
    background: #42a5f5;
  }

  .audio-video-sync-section {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .audio-video-sync-section h3 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .sync-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .input-group input {
    flex: 1;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
  }

  .input-group button {
    padding: 6px 12px;
    background: rgba(100, 181, 246, 0.3);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 4px;
    color: #64b5f6;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .input-group button:hover {
    background: rgba(100, 181, 246, 0.5);
    border-color: rgba(100, 181, 246, 0.6);
  }

  .action-btn {
    padding: 8px 16px;
    background: #64b5f6;
    border: none;
    border-radius: 4px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover:not(:disabled) {
    background: #42a5f5;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: #66bb6a;
  }

  .action-btn.primary:hover:not(:disabled) {
    background: #4caf50;
  }

  .offset-result {
    padding: 8px 12px;
    background: rgba(76, 175, 80, 0.1);
    border: 1px solid rgba(76, 175, 80, 0.3);
    border-radius: 4px;
    color: #4caf50;
    font-size: 12px;
  }

  .offset-result p {
    margin: 0;
  }

  .error-message {
    padding: 8px 12px;
    background: rgba(244, 67, 54, 0.1);
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: 4px;
    color: #f44336;
    font-size: 12px;
  }

  .success-message {
    padding: 8px 12px;
    background: rgba(76, 175, 80, 0.1);
    border: 1px solid rgba(76, 175, 80, 0.3);
    border-radius: 4px;
    color: #4caf50;
    font-size: 12px;
  }
</style>

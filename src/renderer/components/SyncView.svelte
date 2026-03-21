<script lang="ts">
  import { onMount } from 'svelte';

  interface SyncSession {
    id: string;
    backend: string;
    status: 'synced' | 'failed' | 'out-of-sync' | 'syncing' | 'initialized';
    lastSyncTime: string;
  }

  let { projectId }: { projectId: string } = $props();

  let sessions: SyncSession[] = [];
  let isLoading: boolean = true;
  let selectedBackend: string = 'git';

  const backends = ['git', 'dropbox', 's3'];

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
</style>

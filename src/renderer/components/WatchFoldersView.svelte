<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface WatchedFolder {
    path: string;
    addedAt: number;
  }

  interface ActivityEntry {
    filePath: string;
    timestamp: number;
  }

  let watchedFolders: WatchedFolder[] = [];
  let activity: ActivityEntry[] = [];
  let loading = true;
  let error = '';
  let unsubscribers: Array<() => void> = [];

  const af = (window as any).audioforge;

  onMount(async () => {
    await loadFolders();

    // Listen for files auto-added by the watcher
    if (af?.on) {
      unsubscribers.push(
        af.on('library:fileAdded', (data: { filePath: string }) => {
          activity = [
            { filePath: data.filePath, timestamp: Date.now() },
            ...activity,
          ].slice(0, 50); // keep last 50 entries
        })
      );
    }
  });

  onDestroy(() => {
    unsubscribers.forEach(u => u());
  });

  async function loadFolders() {
    loading = true;
    error = '';
    try {
      const paths: string[] = await af.watcher.getWatchedFolders();
      watchedFolders = paths.map(p => ({ path: p, addedAt: Date.now() }));
    } catch (e: any) {
      error = e?.message ?? 'Failed to load watched folders';
    } finally {
      loading = false;
    }
  }

  async function handleAddFolder() {
    try {
      const result = await af.files.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Choose a folder to watch',
      });
      if (result.canceled || !result.filePaths?.length) return;
      const folderPath: string = result.filePaths[0];

      // Prevent duplicates in the UI
      if (watchedFolders.some(f => f.path === folderPath)) return;

      await af.watcher.watchFolder(folderPath);
      watchedFolders = [...watchedFolders, { path: folderPath, addedAt: Date.now() }];
    } catch (e: any) {
      error = e?.message ?? 'Failed to add folder';
    }
  }

  async function handleRemoveFolder(folderPath: string) {
    try {
      await af.watcher.unwatchFolder(folderPath);
      watchedFolders = watchedFolders.filter(f => f.path !== folderPath);
    } catch (e: any) {
      error = e?.message ?? 'Failed to remove folder';
    }
  }

  function formatPath(fullPath: string): string {
    // Show the last 2 path segments for readability
    const parts = fullPath.split('/').filter(Boolean);
    if (parts.length <= 2) return fullPath;
    return '…/' + parts.slice(-2).join('/');
  }

  function formatFileName(fullPath: string): string {
    return fullPath.split('/').pop() ?? fullPath;
  }

  function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
</script>

<div class="watch-folders-view">
  <div class="header">
    <div class="header-text">
      <h1>Watch Folders</h1>
      <p class="subtitle">
        AudioForge monitors these folders (and all subfolders) in the background.
        New audio files are automatically imported and analyzed.
      </p>
    </div>
    <button class="add-btn" onclick={handleAddFolder}>
      + Add Folder
    </button>
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  <!-- Watched folders list -->
  <div class="section">
    <div class="section-title">
      Watching
      {#if watchedFolders.length > 0}
        <span class="count-badge">{watchedFolders.length}</span>
      {/if}
    </div>

    {#if loading}
      <div class="empty-state">Loading…</div>
    {:else if watchedFolders.length === 0}
      <div class="empty-state">
        <div class="empty-icon">👁</div>
        <p>No folders watched yet.</p>
        <p class="empty-hint">Click <strong>+ Add Folder</strong> to start monitoring a folder.</p>
      </div>
    {:else}
      <div class="folder-list">
        {#each watchedFolders as folder (folder.path)}
          <div class="folder-row">
            <div class="folder-icon">📂</div>
            <div class="folder-info">
              <div class="folder-path" title={folder.path}>{formatPath(folder.path)}</div>
              <div class="folder-meta">
                <span class="status-dot"></span>
                <span class="status-text">Active · Recursive</span>
              </div>
            </div>
            <button
              class="remove-btn"
              onclick={() => handleRemoveFolder(folder.path)}
              title="Stop watching this folder"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Activity log -->
  <div class="section">
    <div class="section-title">
      Recent Activity
      {#if activity.length > 0}
        <span class="count-badge">{activity.length}</span>
      {/if}
    </div>

    {#if activity.length === 0}
      <div class="empty-state small">
        <p>Files detected by the watcher will appear here.</p>
      </div>
    {:else}
      <div class="activity-list">
        {#each activity as entry (entry.timestamp + entry.filePath)}
          <div class="activity-row">
            <span class="activity-icon">✓</span>
            <span class="activity-name" title={entry.filePath}>
              {formatFileName(entry.filePath)}
            </span>
            <span class="activity-time">{formatTime(entry.timestamp)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .watch-folders-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    height: 100%;
    overflow-y: auto;
    background: #0f0f1e;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .header-text h1 {
    font-size: 22px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin: 0 0 6px 0;
  }

  .subtitle {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
    max-width: 520px;
    line-height: 1.5;
  }

  .add-btn {
    padding: 8px 16px;
    background: #64b5f6;
    color: #000;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .add-btn:hover {
    background: #7fc3f8;
  }

  .error-banner {
    padding: 10px 14px;
    background: rgba(239, 83, 80, 0.12);
    border: 1px solid rgba(239, 83, 80, 0.3);
    border-radius: 6px;
    color: #ef5350;
    font-size: 13px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .count-badge {
    background: rgba(100, 181, 246, 0.2);
    color: #64b5f6;
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: none;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 36px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    text-align: center;
    gap: 6px;
  }

  .empty-state.small {
    padding: 20px 16px;
  }

  .empty-state p {
    margin: 0;
  }

  .empty-icon {
    font-size: 28px;
    margin-bottom: 4px;
    opacity: 0.5;
  }

  .empty-hint {
    color: rgba(255, 255, 255, 0.3);
    font-size: 12px;
  }

  .folder-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .folder-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    transition: border-color 0.15s;
  }

  .folder-row:hover {
    border-color: rgba(255, 255, 255, 0.14);
  }

  .folder-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .folder-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .folder-path {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
    font-family: 'SF Mono', 'Fira Code', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #81c784;
    flex-shrink: 0;
    box-shadow: 0 0 4px rgba(129, 199, 132, 0.6);
  }

  .status-text {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .remove-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 8px;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .remove-btn:hover {
    color: #ef5350;
    border-color: rgba(239, 83, 80, 0.4);
    background: rgba(239, 83, 80, 0.08);
  }

  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .activity-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    font-size: 12px;
  }

  .activity-icon {
    color: #81c784;
    font-size: 11px;
    flex-shrink: 0;
  }

  .activity-name {
    flex: 1;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .activity-time {
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
</style>

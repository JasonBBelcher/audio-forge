<script lang="ts">
  import { onMount } from 'svelte';

  interface Asset {
    id: number;
    name: string;
    type: 'audio' | 'video';
    size: number;
  }

  let assets: Asset[] = [];
  let filteredAssets: Asset[] = [];
  let isLoading: boolean = true;
  let searchQuery: string = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    isLoading = true;
    try {
      if ((window as any).audioforge?.assets?.list) {
        assets = await (window as any).audioforge.assets.list();
        filteredAssets = assets;
      } else {
        assets = [];
        filteredAssets = [];
      }
    } catch (error) {
      console.error('Failed to list assets:', error);
      assets = [];
      filteredAssets = [];
    } finally {
      isLoading = false;
    }
  });

  function handleSearchChange(e: Event) {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(async () => {
      if ((window as any).audioforge?.assets?.search) {
        const results = await (window as any).audioforge.assets.search(searchQuery);
        filteredAssets = results;
      } else {
        // Client-side filtering
        if (!searchQuery.trim()) {
          filteredAssets = assets;
        } else {
          filteredAssets = assets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
      }
    }, 100);
  }

  async function handleImportFile() {
    try {
      if (!(window as any).audioforge?.files?.showOpenDialog) {
        return;
      }

      const result = await (window as any).audioforge.files.showOpenDialog({
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg'] },
          { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
        ],
      });

      if (result?.filePaths?.[0]) {
        const filePath = result.filePaths[0];

        if ((window as any).audioforge?.assets?.import) {
          await (window as any).audioforge.assets.import(filePath);
          // Refresh assets list
          if ((window as any).audioforge?.assets?.list) {
            assets = await (window as any).audioforge.assets.list();
            filteredAssets = assets;
          }
        }
      }
    } catch (error) {
      console.error('Failed to import file:', error);
    }
  }

  async function handleDeleteFile(id: number) {
    try {
      if ((window as any).audioforge?.assets?.delete) {
        await (window as any).audioforge.assets.delete(id);
        // Remove from local list
        assets = assets.filter(a => a.id !== id);
        filteredAssets = filteredAssets.filter(a => a.id !== id);
      }
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getTotalSize(files: Asset[]): string {
    const total = files.reduce((sum, f) => sum + f.size, 0);
    return formatFileSize(total);
  }
</script>

<div class="files-view">
  <h2>Files</h2>

  {#if isLoading}
    <div class="loading">Loading files...</div>
  {:else if filteredAssets.length === 0 && !searchQuery}
    <div class="empty-state">
      <p>No files imported yet</p>
    </div>
  {:else if filteredAssets.length === 0}
    <div class="empty-state">
      <p>No files match your search</p>
    </div>
  {:else}
    <div class="files-container">
      <div class="files-list">
        {#each filteredAssets as asset (asset.id)}
          <div class="file-item">
            <div class="file-info">
              <span class="file-name">{asset.name}</span>
              <div class="file-meta">
                <span class={`type-badge ${asset.type}`}>{asset.type}</span>
                <span class="file-size">{formatFileSize(asset.size)}</span>
              </div>
            </div>
            <button class="delete-btn" onclick={() => handleDeleteFile(asset.id)}>×</button>
          </div>
        {/each}
      </div>

      <div class="files-stats">
        <div class="stat">
          <span class="label">Total files:</span>
          <span class="value">{filteredAssets.length}</span>
        </div>
        <div class="stat">
          <span class="label">Total size:</span>
          <span class="value">{getTotalSize(filteredAssets)}</span>
        </div>
      </div>
    </div>
  {/if}

  <div class="search-and-import">
    <div class="search-box">
      <input
        type="text"
        placeholder="Search files..."
        value={searchQuery}
        onchange={handleSearchChange}
        oninput={handleSearchChange}
      />
    </div>
    <button class="import-btn" onclick={handleImportFile}>Import File</button>
  </div>
</div>

<style>
  .files-view {
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

  .files-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .files-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-name {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    word-break: break-word;
  }

  .file-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 11px;
  }

  .type-badge {
    padding: 2px 6px;
    border-radius: 2px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .type-badge.audio {
    background: rgba(100, 181, 246, 0.2);
    color: #64b5f6;
  }

  .type-badge.video {
    background: rgba(156, 39, 176, 0.2);
    color: #9c27b0;
  }

  .file-size {
    color: rgba(255, 255, 255, 0.5);
  }

  .delete-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(244, 67, 54, 0.2);
    border: 1px solid rgba(244, 67, 54, 0.4);
    border-radius: 2px;
    color: #f44336;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-btn:hover {
    background: rgba(244, 67, 54, 0.3);
    border-color: rgba(244, 67, 54, 0.6);
  }

  .files-stats {
    display: flex;
    gap: 16px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat .label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat .value {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .search-and-import {
    display: flex;
    gap: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
  }

  .search-box {
    flex: 1;
  }

  input {
    width: 100%;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  input:focus {
    outline: none;
    border-color: #64b5f6;
    background: rgba(255, 255, 255, 0.08);
  }

  .import-btn {
    padding: 6px 12px;
    background: #64b5f6;
    border: none;
    border-radius: 4px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .import-btn:hover {
    background: #42a5f5;
  }
</style>

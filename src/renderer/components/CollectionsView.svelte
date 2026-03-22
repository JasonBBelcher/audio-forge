<script lang="ts">
  import Button from './ui/Button.svelte';

  interface Collection {
    id: number;
    name: string;
    description?: string;
    assetCount: number;
    created_at: string;
    updated_at: string;
  }

  interface Asset {
    id: number;
    name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    bpm?: number;
    key?: string;
    duration?: number;
    created_at: string;
  }

  let collections: Collection[] = [];
  let selectedCollection: Collection | null = null;
  let assets: Asset[] = [];
  let showNewCollectionForm = false;
  let newCollectionName = '';
  let newCollectionDescription = '';
  let isLoading = false;
  let error: string | null = null;

  async function loadCollections(): Promise<void> {
    isLoading = true;
    error = null;
    try {
      collections = await (window as any).audioforge.collections.list();
    } catch (err) {
      error = `Failed to load collections: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }

  async function selectCollection(collection: Collection): Promise<void> {
    selectedCollection = collection;
    isLoading = true;
    error = null;
    try {
      assets = await (window as any).audioforge.collections.listAssets(collection.id);
    } catch (err) {
      error = `Failed to load assets: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }

  async function handleCreateCollection(): Promise<void> {
    if (!newCollectionName.trim()) {
      error = 'Collection name is required';
      return;
    }

    error = null;
    try {
      const collection = await (window as any).audioforge.collections.create(
        newCollectionName,
        newCollectionDescription || undefined
      );
      newCollectionName = '';
      newCollectionDescription = '';
      showNewCollectionForm = false;
      await loadCollections();
      selectCollection(collection);
    } catch (err) {
      error = `Failed to create collection: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  async function handleDeleteCollection(): Promise<void> {
    if (!selectedCollection) return;

    if (!confirm(`Delete collection "${selectedCollection.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await (window as any).audioforge.collections.delete(selectedCollection.id);
      selectedCollection = null;
      assets = [];
      await loadCollections();
    } catch (err) {
      error = `Failed to delete collection: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  async function handleRemoveAsset(assetId: number): Promise<void> {
    if (!selectedCollection) return;

    try {
      await (window as any).audioforge.collections.removeAsset(selectedCollection.id, assetId);
      await selectCollection(selectedCollection);
    } catch (err) {
      error = `Failed to remove asset: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  async function handleExportZip(): Promise<void> {
    if (!selectedCollection) return;

    try {
      const result = await (window as any).audioforge.files.showSaveDialog({
        defaultPath: `${selectedCollection.name}.zip`,
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
      });

      if (result.canceled || !result.filePath) return;

      await (window as any).audioforge.collections.exportZip(selectedCollection.id, result.filePath);
      // Show success message
      alert(`Collection exported to ${result.filePath}`);
    } catch (err) {
      error = `Failed to export collection: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Load collections on mount
  import { onMount } from 'svelte';
  onMount(loadCollections);
</script>

<div class="collections-view">
  <div class="header">
    <h2>Collections</h2>
  </div>

  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}

  <div class="main-content">
    <!-- Left panel: Collections list -->
    <div class="panel-left">
      <div class="collections-header">
        <h3>Your Collections</h3>
        <Button variant="primary" on:click={() => (showNewCollectionForm = true)}>
          + New Collection
        </Button>
      </div>

      {#if showNewCollectionForm}
        <div class="new-collection-form">
          <form on:submit|preventDefault={handleCreateCollection}>
            <input
              type="text"
              placeholder="Collection name"
              bind:value={newCollectionName}
              required
            />
            <input
              type="text"
              placeholder="Description (optional)"
              bind:value={newCollectionDescription}
            />
            <div class="form-buttons">
              <Button variant="primary" type="submit">Create</Button>
              <Button variant="secondary" type="button" on:click={() => {
                showNewCollectionForm = false;
                newCollectionName = '';
                newCollectionDescription = '';
              }}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      {/if}

      {#if isLoading}
        <div class="empty-state">Loading collections...</div>
      {:else if collections.length === 0}
        <div class="empty-state">
          No collections yet. Create one to get started!
        </div>
      {:else}
        <div class="collections-list">
          {#each collections as collection (collection.id)}
            <button
              class={`collection-item ${selectedCollection?.id === collection.id ? 'selected' : ''}`}
              on:click={() => selectCollection(collection)}
              type="button"
            >
              <div class="collection-info">
                <div class="collection-name">{collection.name}</div>
                {#if collection.description}
                  <div class="collection-description">{collection.description}</div>
                {/if}
              </div>
              <div class="collection-count">
                {collection.assetCount} {collection.assetCount === 1 ? 'asset' : 'assets'}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right panel: Selected collection details -->
    <div class="panel-right">
      {#if selectedCollection}
        <div class="collection-details">
          <div class="details-header">
            <h3>{selectedCollection.name}</h3>
            {#if selectedCollection.description}
              <p class="description">{selectedCollection.description}</p>
            {/if}
          </div>

          <div class="details-actions">
            <Button variant="primary" on:click={handleExportZip} disabled={assets.length === 0}>
              Export ZIP
            </Button>
            <Button variant="danger" on:click={handleDeleteCollection}>
              Delete Collection
            </Button>
          </div>

          {#if assets.length === 0}
            <div class="empty-state">
              No assets in this collection. Add assets from the library.
            </div>
          {:else}
            <div class="assets-list">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>BPM</th>
                    <th>Key</th>
                    <th>Duration</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {#each assets as asset (asset.id)}
                    <tr>
                      <td class="col-name">{asset.name}</td>
                      <td>{asset.bpm || '-'}</td>
                      <td>{asset.key || '-'}</td>
                      <td>{formatDuration(asset.duration)}</td>
                      <td>{asset.file_type.toUpperCase()}</td>
                      <td>{formatFileSize(asset.file_size)}</td>
                      <td>
                        <button
                          class="remove-button"
                          on:click={() => handleRemoveAsset(asset.id)}
                          title="Remove from collection"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {:else if collections.length > 0}
        <div class="empty-state">
          Select a collection to view its assets.
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .collections-view {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #1a1a1a;
  }

  .header {
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 16px;
  }

  h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .error-message {
    padding: 12px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    color: #ff6b6b;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .main-content {
    flex: 1;
    display: flex;
    gap: 16px;
    min-height: 0;
  }

  .panel-left,
  .panel-right {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .panel-left {
    width: 300px;
    padding: 16px;
    overflow-y: auto;
  }

  .panel-right {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .collections-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .new-collection-form {
    background: rgba(255, 255, 255, 0.05);
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .new-collection-form form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .new-collection-form input {
    padding: 8px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
  }

  .new-collection-form input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .form-buttons {
    display: flex;
    gap: 8px;
  }

  .collections-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .collection-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
  }

  .collection-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .collection-item.selected {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
  }

  .collection-item:focus {
    outline: 2px solid rgba(99, 102, 241, 0.5);
  }

  .collection-info {
    flex: 1;
    min-width: 0;
  }

  .collection-name {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
  }

  .collection-description {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .collection-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    margin-left: 8px;
  }

  .collection-details {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .details-header {
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 12px;
  }

  .details-header p {
    margin: 8px 0 0 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  .description {
    color: rgba(255, 255, 255, 0.6) !important;
  }

  .details-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    text-align: center;
    padding: 20px;
  }

  .assets-list {
    flex: 1;
    overflow-y: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  thead {
    position: sticky;
    top: 0;
    background: rgba(0, 0, 0, 0.2);
  }

  th {
    padding: 8px 4px;
    text-align: left;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  td {
    padding: 8px 4px;
    color: rgba(255, 255, 255, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .col-name {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
  }

  .remove-button {
    background: none;
    border: none;
    color: rgba(255, 107, 107, 0.6);
    cursor: pointer;
    font-size: 18px;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    transition: all 0.2s;
  }

  .remove-button:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
  }
</style>

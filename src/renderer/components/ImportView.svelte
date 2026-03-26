<script lang="ts">
  import { onMount } from 'svelte';

  interface ImportedFile {
    jobId: string;
    asset?: {
      id: number;
      name: string;
      file_type: string;
      bpm?: number;
      key?: string;
      duration?: number;
    };
    status: 'pending' | 'analyzing' | 'completed' | 'failed';
    error?: string;
  }

  let importedFiles: ImportedFile[] = [];
  let isDragging = false;
  let isAnalyzing = false;

  const SUPPORTED_FORMATS = ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a', 'aac'];

  function formatDuration(seconds?: number): string {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async function handleFileSelection(filePaths: string[]) {
    isAnalyzing = true;
    try {
      const results = await window.audioforge.files.import(filePaths);

      for (const result of results) {
        if (result.error) {
          importedFiles = [
            ...importedFiles,
            {
              jobId: result.filePath,
              status: 'failed',
              error: result.error,
            },
          ];
        } else {
          importedFiles = [
            ...importedFiles,
            {
              jobId: result.jobId,
              asset: result.asset,
              status: 'pending',
            },
          ];
        }
      }

      // Subscribe to job completion events
      subscribeToJobUpdates();
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      isAnalyzing = false;
    }
  }

  function subscribeToJobUpdates() {
    if (!window.audioforge?.on) {
      return () => {};
    }

    const unsubscribe = window.audioforge.on('job:complete', (data: any) => {
      const fileIndex = importedFiles.findIndex((f) => f.jobId === data.jobId);
      if (fileIndex !== -1) {
        importedFiles[fileIndex].status = 'completed';
        if (data.result) {
          importedFiles[fileIndex].asset = {
            ...importedFiles[fileIndex].asset!,
            bpm: data.result.bpm,
            key: data.result.key,
            duration: data.result.durationSec,
          };
        }
        importedFiles = [...importedFiles];
      }
    });

    const unsubscribeFailed = window.audioforge.on('job:failed', (data: any) => {
      const fileIndex = importedFiles.findIndex((f) => f.jobId === data.jobId);
      if (fileIndex !== -1) {
        importedFiles[fileIndex].status = 'failed';
        importedFiles[fileIndex].error = data.error || 'Analysis failed';
        importedFiles = [...importedFiles];
      }
    });

    return () => {
      unsubscribe();
      unsubscribeFailed();
    };
  }

  async function handleBrowseFiles() {
    const result = await window.audioforge.files.showOpenDialog({
      filters: [
        {
          name: 'Audio Files',
          extensions: SUPPORTED_FORMATS,
        },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      await handleFileSelection(result.filePaths);
    }
  }

  async function handleBrowseFolder() {
    const result = await window.audioforge.files.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      // Scan the folder recursively for audio files
      const filePaths: string[] = await (window.audioforge.files as any).scanFolder(folderPath);
      if (filePaths.length > 0) {
        await handleFileSelection(filePaths);
      }
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const filePaths = Array.from(files).map((f) => (f as any).path);
      handleFileSelection(filePaths);
    }
  }

  async function handleAnalyzeAll() {
    isAnalyzing = true;
    try {
      const result = await window.audioforge.files.analyzeAll();
      console.log('Batch analysis queued:', result);
    } catch (error) {
      console.error('Batch analysis failed:', error);
    } finally {
      isAnalyzing = false;
    }
  }

  onMount(() => {
    return subscribeToJobUpdates();
  });
</script>

<div class="import-view">
  <div class="header">
    <h2>Import Audio Files</h2>
    <p class="subtitle">Add files to your library for automatic analysis</p>
  </div>

  <div class="content">
    {#if importedFiles.length === 0}
      <div
        class="drop-zone"
        class:dragging={isDragging}
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
        on:drop={handleDrop}
        role="button"
        tabindex="0"
      >
        <div class="drop-zone-content">
          <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2v10M2 12h10M12 22v-10M22 12h-10M6 6l12 12M18 6l-12 12" stroke-width="2" stroke-linecap="round" />
          </svg>
          <h3>Drop audio files here</h3>
          <p>or choose files / folder below</p>
          <p class="formats">Supported: {SUPPORTED_FORMATS.join(', ')}</p>
        </div>
        <div class="browse-buttons">
          <button class="browse-btn" on:click={handleBrowseFiles} disabled={isAnalyzing}>
            Browse Files...
          </button>
          <button class="browse-btn folder-btn" on:click={handleBrowseFolder} disabled={isAnalyzing}>
            📁 Import Folder...
          </button>
        </div>
      </div>
    {:else}
      <div class="imports-container">
        <div class="imports-header">
          <h3>Recent Imports</h3>
          <div class="header-actions">
            <button class="browse-sm-btn" on:click={handleBrowseFiles} disabled={isAnalyzing}>+ Files</button>
            <button class="browse-sm-btn" on:click={handleBrowseFolder} disabled={isAnalyzing}>📁 Folder</button>
            <button class="analyze-all-btn" on:click={handleAnalyzeAll} disabled={isAnalyzing}>
              {isAnalyzing ? 'Analyzing...' : 'Analyze All Unanalyzed'}
            </button>
          </div>
        </div>

        <div class="imports-list">
          {#each importedFiles as file (file.jobId)}
            <div class="import-item" class:failed={file.status === 'failed'}>
              <div class="item-status">
                {#if file.status === 'pending'}
                  <div class="spinner"></div>
                {:else if file.status === 'analyzing'}
                  <div class="spinner"></div>
                {:else if file.status === 'completed'}
                  <svg class="check-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.3 5.3L9 16.6l-4.3-4.3L3 15l6 6 12-12-1.7-1.7z" />
                  </svg>
                {:else}
                  <svg class="error-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z" />
                  </svg>
                {/if}
              </div>

              <div class="item-info">
                <div class="item-name">{file.asset?.name || file.jobId}</div>
                {#if file.error}
                  <div class="item-error">{file.error}</div>
                {:else if file.asset}
                  <div class="item-metadata">
                    {#if file.asset.bpm}
                      <span class="meta-item">BPM: {file.asset.bpm.toFixed(1)}</span>
                    {:else}
                      <span class="meta-item placeholder">BPM: —</span>
                    {/if}
                    {#if file.asset.key}
                      <span class="meta-item">Key: {file.asset.key}</span>
                    {:else}
                      <span class="meta-item placeholder">Key: —</span>
                    {/if}
                    {#if file.asset.duration}
                      <span class="meta-item">Duration: {formatDuration(file.asset.duration)}</span>
                    {:else}
                      <span class="meta-item placeholder">Duration: —</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <button class="browse-btn" on:click={handleBrowseFiles} disabled={isAnalyzing}>
          Import More Files...
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .import-view {
    padding: 20px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    margin-bottom: 24px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .subtitle {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Drop Zone */
  .drop-zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    transition: all 0.2s ease;
  }

  .drop-zone.dragging {
    border-color: rgb(66, 184, 221);
    background-color: rgba(66, 184, 221, 0.05);
  }

  .drop-zone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .drop-icon {
    width: 48px;
    height: 48px;
    color: rgba(255, 255, 255, 0.4);
  }

  .drop-zone h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .drop-zone > .drop-zone-content > p {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }

  .formats {
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.5) !important;
    margin-top: 8px !important;
  }

  /* Imports Container */
  .imports-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .imports-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .imports-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  /* Imports List */
  .imports-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 8px;
  }

  .imports-list::-webkit-scrollbar {
    width: 6px;
  }

  .imports-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .imports-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .imports-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Import Item */
  .import-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border-left: 3px solid rgb(66, 184, 221);
    transition: background 0.2s ease;
  }

  .import-item.failed {
    border-left-color: rgb(255, 71, 87);
    background: rgba(255, 71, 87, 0.05);
  }

  .import-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .item-status {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(66, 184, 221, 0.3);
    border-top-color: rgb(66, 184, 221);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .check-icon {
    width: 20px;
    height: 20px;
    color: rgb(76, 175, 80);
  }

  .error-icon {
    width: 20px;
    height: 20px;
    color: rgb(255, 71, 87);
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-error {
    margin: 4px 0 0;
    font-size: 12px;
    color: rgb(255, 71, 87);
  }

  .item-metadata {
    margin: 6px 0 0;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .meta-item.placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* Buttons */
  .browse-btn,
  .analyze-all-btn {
    padding: 10px 16px;
    background: rgb(66, 184, 221);
    color: rgba(255, 255, 255, 0.95);
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .browse-btn:hover:not(:disabled),
  .analyze-all-btn:hover:not(:disabled) {
    background: rgb(56, 174, 211);
  }

  .browse-btn:disabled,
  .analyze-all-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .browse-btn {
    align-self: center;
    margin-top: 16px;
  }

  .analyze-all-btn {
    padding: 8px 12px;
    font-size: 12px;
  }
</style>

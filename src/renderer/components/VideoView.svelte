<script lang="ts">
  import { onMount } from 'svelte';

  interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
    codec: string;
  }

  let filePath: string | null = null;
  let metadata: VideoMetadata | null = null;
  let isExtracting: boolean = false;
  let extractionSuccess: boolean | null = null;
  let extractionError: string | null = null;
  let isLoading: boolean = false;

  async function handleImportVideo() {
    try {
      if (!(window as any).audioforge?.files?.showOpenDialog) {
        return;
      }

      const result = await (window as any).audioforge.files.showOpenDialog({
        filters: [{ name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] }],
      });

      if (result?.filePaths?.[0]) {
        filePath = result.filePaths[0];

        if ((window as any).audioforge?.video?.getMetadata) {
          metadata = await (window as any).audioforge.video.getMetadata(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to import video:', error);
    }
  }

  async function handleExtractAudio() {
    if (!filePath) return;

    isExtracting = true;
    extractionSuccess = null;
    extractionError = null;

    try {
      if ((window as any).audioforge?.video?.extractAudio) {
        await (window as any).audioforge.video.extractAudio(filePath);
        extractionSuccess = true;
      }
    } catch (error: any) {
      extractionSuccess = false;
      extractionError = error?.message || 'Failed to extract audio';
    } finally {
      isExtracting = false;
    }
  }

  function getFileName(path: string): string {
    return path.split(/[/\\]/).pop() || path;
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
</script>

<div class="video-view">
  <h2>Video</h2>

  {#if !filePath}
    <div class="empty-state">
      <p>No video imported yet</p>
      <button onclick={handleImportVideo}>Import Video</button>
    </div>
  {:else}
    <div class="video-content">
      <div class="file-info">
        <div class="file-name">{getFileName(filePath)}</div>

        {#if metadata}
          <div class="metadata">
            <div class="metadata-item">
              <span class="label">Duration:</span>
              <span class="value">{formatDuration(metadata.duration)}</span>
            </div>
            <div class="metadata-item">
              <span class="label">Resolution:</span>
              <span class="value">{metadata.width}×{metadata.height}</span>
            </div>
            <div class="metadata-item">
              <span class="label">Codec:</span>
              <span class="value">{metadata.codec}</span>
            </div>
          </div>
        {/if}
      </div>

      {#if isExtracting}
        <div class="status extracting">Extracting audio...</div>
      {/if}

      {#if extractionSuccess === true}
        <div class="status success">Audio extracted successfully!</div>
      {/if}

      {#if extractionSuccess === false}
        <div class="status error">Error: {extractionError}</div>
      {/if}

      <div class="actions">
        <button onclick={handleImportVideo}>Change Video</button>
        <button onclick={handleExtractAudio} disabled={isExtracting}>Extract Audio</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .video-view {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  h2 {
    margin: 0 0 20px 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .video-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .file-info {
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .file-name {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 12px;
    word-break: break-word;
  }

  .metadata {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .metadata-item {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .metadata-item .label {
    color: rgba(255, 255, 255, 0.6);
  }

  .metadata-item .value {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
  }

  .status {
    padding: 12px;
    border-radius: 4px;
    font-size: 13px;
  }

  .status.extracting {
    background: rgba(25, 200, 255, 0.1);
    color: #64b5f6;
  }

  .status.success {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }

  .status.error {
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  button {
    flex: 1;
    padding: 8px 12px;
    background: #64b5f6;
    border: none;
    border-radius: 4px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button:hover:not(:disabled) {
    background: #42a5f5;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

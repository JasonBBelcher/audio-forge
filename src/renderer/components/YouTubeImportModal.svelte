<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';

  export let trackId: string;
  export let trackName: string;

  const dispatch = createEventDispatcher<{
    imported: { filePath: string; title: string };
    close: void;
  }>();

  type Phase = 'input' | 'fetching' | 'preview' | 'downloading' | 'done' | 'error';

  let url = '';
  let phase: Phase = 'input';
  let errorMsg = '';
  let videoInfo: { title: string; duration: number; uploader?: string; thumbnail?: string } | null = null;
  let progress = 0;
  let progressText = '';

  const af = (window as any).audioforge;

  // Tracks all active event unsub functions so onDestroy can clean up
  // if the modal is closed mid-download (prevents listener leaks).
  let activeUnsubs: Array<() => void> = [];

  onDestroy(() => {
    activeUnsubs.forEach(fn => fn());
    activeUnsubs = [];
  });

  function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function handleFetchInfo() {
    if (!url.trim()) return;
    phase = 'fetching';
    errorMsg = '';
    try {
      videoInfo = await af.youtube.getInfo(url.trim());
      phase = 'preview';
    } catch (e: any) {
      errorMsg = e.message?.includes('Invalid') ? 'Not a valid YouTube URL.' : 'Could not fetch video info. Is yt-dlp installed?';
      phase = 'error';
    }
  }

  async function handleDownload() {
    if (!videoInfo) return;
    phase = 'downloading';
    progress = 0;

    const mediaDir = await af.files.getMediaDir();

    // Listen for progress events from job executor
    const unsubProgress = af.on('youtube:progress', (data: any) => {
      if (data.trackId === trackId) {
        progress = data.percent;
        progressText = `${data.percent.toFixed(1)}% • ${data.speed} • ETA ${data.eta}`;
      }
    });

    try {
      // Enqueue the download job and get jobId back
      const result = await af.youtube.download(url.trim(), trackId, mediaDir);
      const jobId = result.jobId;

      // Listen for job completion
      const unsubComplete = af.on('job:complete', (data: any) => {
        if (data.jobId === jobId) {
          unsubComplete();
          unsubFailed();
          unsubProgress();
          const filePath = data.result.filePath;
          dispatch('imported', { filePath, title: videoInfo!.title });
          phase = 'done';
        }
      });

      // Listen for job failure
      const unsubFailed = af.on('job:failed', (data: any) => {
        if (data.jobId === jobId) {
          unsubComplete();
          unsubFailed();
          unsubProgress();
          errorMsg = data.error || 'Download failed';
          phase = 'error';
        }
      });
    } catch (e: any) {
      unsubProgress();
      errorMsg = e.message || 'Download failed';
      phase = 'error';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && phase === 'input') handleFetchInfo();
  }

  function reset() {
    url = '';
    phase = 'input';
    errorMsg = '';
    videoInfo = null;
    progress = 0;
  }
</script>

<Modal title="Import from YouTube" width="520px" on:close={() => dispatch('close')}>
  <div class="yt-import">
    {#if phase === 'input' || phase === 'fetching'}
      <p class="subtitle">Paste a YouTube URL to download audio into <strong>{trackName}</strong></p>

      <div class="url-row">
        <input
          type="url"
          bind:value={url}
          placeholder="https://youtube.com/watch?v=..."
          on:keydown={handleKeydown}
          disabled={phase === 'fetching'}
          class="url-input"
        />
        <Button variant="primary" on:click={handleFetchInfo} disabled={!url.trim() || phase === 'fetching'}>
          {phase === 'fetching' ? '…' : 'Fetch'}
        </Button>
      </div>

      {#if phase === 'fetching'}
        <div class="spinner-row">
          <div class="spinner"></div>
          <span>Fetching video info…</span>
        </div>
      {/if}

    {:else if phase === 'preview' && videoInfo}
      <div class="preview">
        {#if videoInfo.thumbnail}
          <img src={videoInfo.thumbnail} alt="thumbnail" class="thumb" />
        {/if}
        <div class="preview-info">
          <h3>{videoInfo.title}</h3>
          <p class="meta">
            {#if videoInfo.uploader}<span>{videoInfo.uploader}</span> •{/if}
            <span>{formatDuration(videoInfo.duration)}</span>
          </p>
          <p class="into-track">Will download as WAV → <strong>{trackName}</strong></p>
        </div>
      </div>

      <div class="actions">
        <Button variant="secondary" on:click={reset}>← Back</Button>
        <Button variant="primary" on:click={handleDownload}>⬇ Download Audio</Button>
      </div>

    {:else if phase === 'downloading'}
      <div class="download-progress">
        <p>Downloading audio…</p>
        <div class="progress-bar-wrap">
          <div class="progress-bar" style={`width: ${progress}%`}></div>
        </div>
        <p class="progress-text">{progressText || 'Starting…'}</p>
        <p class="note">yt-dlp is extracting audio. This may take a moment.</p>
      </div>

    {:else if phase === 'error'}
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{errorMsg}</p>
        {#if errorMsg.includes('yt-dlp')}
          <p class="install-hint">Install yt-dlp: <code>brew install yt-dlp</code></p>
        {/if}
        <Button variant="secondary" on:click={reset}>Try Again</Button>
      </div>
    {/if}
  </div>
</Modal>

<style>
  .yt-import {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .subtitle {
    margin: 0;
    color: #a0a0b8;
    font-size: 0.9rem;
  }

  .url-row {
    display: flex;
    gap: 0.75rem;
  }

  .url-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #e0e0f0;
    padding: 0.65rem 0.9rem;
    font-size: 0.9rem;
    min-width: 0;
  }

  .url-input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
  }

  .url-input:disabled {
    opacity: 0.5;
  }

  .spinner-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #a0a0b8;
    font-size: 0.9rem;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(99, 102, 241, 0.3);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .preview {
    display: flex;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 1rem;
  }

  .thumb {
    width: 120px;
    height: 68px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .preview-info {
    flex: 1;
    min-width: 0;
  }

  .preview-info h3 {
    margin: 0 0 0.4rem;
    font-size: 0.95rem;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .meta {
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
    color: #a0a0b8;
  }

  .into-track {
    margin: 0;
    font-size: 0.8rem;
    color: #6366f1;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .download-progress {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 0;
    text-align: center;
  }

  .download-progress p {
    margin: 0;
    color: #e0e0f0;
  }

  .progress-bar-wrap {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 99px;
    height: 8px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 99px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.8rem;
    color: #a0a0b8 !important;
  }

  .note {
    font-size: 0.75rem;
    color: #505060 !important;
  }

  .error-state {
    text-align: center;
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .error-icon {
    font-size: 2rem;
  }

  .error-state p {
    margin: 0;
    color: #ef4444;
  }

  .install-hint {
    color: #a0a0b8 !important;
    font-size: 0.85rem;
  }

  code {
    background: rgba(255, 255, 255, 0.08);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }
</style>
